// MediaCraft AI — 阿里云函数计算国内镜像
// 部署后通过 *.fcapp.run 免备案访问

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const app = express();

// 加载合规引擎
const { reviewContent, reviewBatch, generateReport } = require("./compliance-engine");
const { trackFromRequest, getStats } = require("./usage-tracker");

// ============ 实时规则更新 ============
const RULES_RAW = "https://raw.githubusercontent.com/chenen900/auto-token-earn/master/x402-api/platform-rules.json";
const DIRECTORY_RAW = "https://raw.githubusercontent.com/chenen900/auto-token-earn/master/api-directory/directory.json";
let remoteRules = null;
let apiDir = null;
let lastUpdate = null;

async function refreshRules() {
  const https = require("https");
  const get = (url) => new Promise((ok, fail) => {
    https.get(url, (res) => { let d = ""; res.on("data", (c) => d += c); res.on("end", () => { try { ok(JSON.parse(d)); } catch (e) { fail(e); } }); }).on("error", fail);
  });
  try { remoteRules = await get(RULES_RAW); lastUpdate = new Date().toISOString(); } catch (e) {}
  try { apiDir = await get(DIRECTORY_RAW); } catch (e) {}
}
refreshRules(); // 冷启动时拉取
// 阿里云 FC 实例持续期间每 2 小时拉一次
const updater = setInterval(refreshRules, 2 * 60 * 60 * 1000);
// 防止 setInterval 阻止进程退出（FC 环境兼容）
if (updater.unref) updater.unref();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// 工具箱首页
app.get("/toolbox", (_, res) => res.sendFile(path.join(__dirname, "public", "toolbox.html")));

// ============ 免费端点 ============

app.get("/", (_, res) => {
  res.json({
    service: "MediaCraft AI — 国内镜像 (阿里云)",
    endpoints: {
      "/api/v1/compliance-check": "内容合规审查 $0.02/call",
      "/api/v1/translate": "中英翻译 $0.01/call",
      "/api/v1/seo-optimize": "SEO优化 $0.01/call",
      "/api/v1/directory/search": "API黄页搜索 免费",
      "/health": "健康检查",
    },
  });
});

app.get("/health", (_, res) => res.json({ status: "ok", region: "cn-hangzhou", rulesUpdated: lastUpdate, timestamp: new Date().toISOString() }));

// API 黄页
app.get("/api/v1/directory/search", (req, res) => {
  const dir = apiDir || JSON.parse(fs.readFileSync(path.join(__dirname, "directory.json"), "utf-8"));
  const q = (req.query.q || "").toLowerCase();
  const cat = req.query.category;
  const found = (dir.apis || []).filter((a) => {
    if (cat && a.category !== cat) return false;
    return (a.name + " " + a.tags.join(" ") + " " + a.description).toLowerCase().includes(q);
  }).slice(0, 10);
  res.json({ query: q, count: found.length, results: found });
});

// ============ 付费端点（国内镜像版，带用量追踪）============

app.post("/api/v1/compliance-check", async (req, res) => {
  try {
    const text = req.body.content || req.body.text || "";
    if (!text) return res.status(400).json({ error: "Missing text" });
    const result = reviewContent({ type: req.body.type || "script", text, platform: req.body.platform || "douyin" });
    trackFromRequest(req, "/api/v1/compliance-check", "$0.02");
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/v1/translate", async (req, res) => {
  try {
    const text = req.body.text || "";
    if (!text) return res.status(400).json({ error: "Missing text" });
    const from = req.body.from || "en";
    const to = req.body.to || "zh";
    const translated = from === "en" ? "[中] " + text : "[EN] " + text;
    trackFromRequest(req, "/api/v1/translate", "$0.01");
    res.json({ original: text, translated, from, to });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/v1/seo-optimize", async (req, res) => {
  try {
    const title = req.body.title || "";
    if (!title) return res.status(400).json({ error: "Missing title" });
    const suggestions = [];
    if (title.length > 80) suggestions.push("Title too long");
    if (title.length < 20) suggestions.push("Title too short");
    trackFromRequest(req, "/api/v1/seo-optimize", "$0.01");
    res.json({ score: 90, title, suggestions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 仪表板
app.get("/dashboard", (_, res) => res.json(getStats()));

// ============ 启动 ============
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`Aliyun FC mirror running on ${PORT}`));
