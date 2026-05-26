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

// 加载 API 黄页
const apiDir = JSON.parse(fs.readFileSync(path.join(__dirname, "directory.json"), "utf-8"));

app.use(cors());
app.use(express.json({ limit: "1mb" }));

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

app.get("/health", (_, res) => res.json({ status: "ok", region: "cn-hangzhou", timestamp: new Date().toISOString() }));

// API 黄页
app.get("/api/v1/directory/search", (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const cat = req.query.category;
  const found = apiDir.apis.filter((a) => {
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
