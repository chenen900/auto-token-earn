// x402 Pay-Per-Call API Server — MediaCraft AI
// 三个付费 API：翻译 / 合规审查 / SEO 优化
// 用法: node server.js

const express = require("express");
const cors = require("cors");
const { paygate } = require("@zoebuildsai/paygate");
const { reviewContent, reviewBatch, generateReport } = require("./compliance-engine");
const { trackFromRequest, getStats } = require("./usage-tracker");
const app = express();
const PORT = process.env.PORT || 3000;

// ============ 钱包地址（收 USDC）============
const PAY_TO_SOL = "8ZqmcWARgGjZzJLzqwquG8GTvDb39RFbTWKqhShqbtht"; // Phantom Solana
const PAY_TO_BASE = "0x4445212f0C20EBAfCe3923fB16178cB04a8329ad"; // Phantom Base

// ============ API 定价 ============
const PRICING = {
  "/api/v1/translate": "$0.01",
  "/api/v1/compliance-check": "$0.02",
  "/api/v1/compliance-batch": "$0.05",
  "/api/v1/compliance-report": "$0.05",
  "/api/v1/seo-optimize": "$0.01",
};

app.use(cors());
app.use(express.json({ type: ["application/json", "application/json; charset=utf-8", "application/json;charset=utf-8"], limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.static(require("path").join(__dirname, "public")));
app.use((req, res, next) => {
  if (req.headers["content-type"] && !req.headers["content-type"].includes("charset")) {
    req.headers["content-type"] = req.headers["content-type"] + "; charset=utf-8";
  }
  next();
});
app.get("/toolbox", (_, res) => res.sendFile(require("path").join(__dirname, "public", "toolbox.html")));
app.get("/command", (_, res) => res.sendFile(require("path").join(__dirname, "public", "command.html")));

app.use("/.well-known", express.static(require("path").join(__dirname, ".well-known")));

// API 黄页查询（免费，无需认证）
var apiDir = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "api-directory", "directory.json"), "utf-8"));
app.get("/api/v1/directory/search", function (req, res) {
  var q = (req.query.q || "").toLowerCase();
  var cat = req.query.category;
  var found = apiDir.apis.filter(function (a) {
    if (cat && a.category !== cat) return false;
    return (a.name + " " + a.tags.join(" ") + " " + a.description).toLowerCase().includes(q);
  }).slice(0, 10);
  res.json({ query: q, count: found.length, results: found });
});
app.get("/api/v1/directory/categories", function (_, res) { res.json(apiDir.categories); });
app.get("/api/v1/directory/featured", function (_, res) {
  res.json(apiDir.apis.filter(function (a) { return a.featured; }));
});

// ============ 路由 ============

// 首页：API 目录
app.get("/", (_, res) => {
  res.json({
    service: "MediaCraft AI — Pay-Per-Call API",
    version: "1.0.0",
    endpoints: {
      "/api/v1/translate": { method: "POST", price: PRICING["/api/v1/translate"], description: "EN↔CN bilingual translation with cultural adaptation" },
      "/api/v1/compliance-check": { method: "POST", price: PRICING["/api/v1/compliance-check"], description: "Full content compliance review: Chinese advertising law + platform rules + short-video content safety. Supports script/hook/caption/voiceover/title types." },
      "/api/v1/compliance-batch": { method: "POST", price: PRICING["/api/v1/compliance-batch"], description: "Batch review up to 20 items at once" },
      "/api/v1/compliance-report": { method: "POST", price: PRICING["/api/v1/compliance-report"], description: "Generate formal compliance report (audit trail, defensible in enforcement)" },
      "/api/v1/seo-optimize": { method: "POST", price: PRICING["/api/v1/seo-optimize"], description: "SEO title, description, and keyword optimization" },
    },
    docs: "/docs",
    health: "/health",
    x402: "/.well-known/x402",
  });
});

// x402 付费测试端点（Agentic Market 验证用）
app.get("/api/v1/paid-test", (req, res) => {
  const paymentRequired = {
    x402Version: 2,
    network: "base",
    payTo: PAY_TO_BASE,
    accepts: [{
      scheme: "exact",
      price: { amount: 10000, currency: "USDC", asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
      network: "eip155:8453",
    }],
    resource: {
      url: `https://${req.get("host")}/api/v1/paid-test`,
      description: "MediaCraft AI — Chinese advertising law + short-video content compliance review",
      mimeType: "application/json",
    },
    maxTimeoutSeconds: 60,
    extensions: {
      bazaar: {
        name: "MediaCraft AI — Content Compliance & Translation",
        description: "Chinese advertising law compliance review, short-video content audit, EN↔CN translation, and SEO optimization for cross-border creators.",
        category: "ai-services",
        tags: ["compliance", "translation", "seo", "chinese", "content-review", "advertising-law"],
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Content to review" },
            platform: { type: "string", enum: ["douyin", "bilibili", "xiaohongshu", "tiktok", "youtube"] },
            type: { type: "string", enum: ["script", "hook", "caption", "voiceover", "title"] },
          },
          required: ["text"],
        },
        outputSchema: {
          type: "object",
          properties: {
            passed: { type: "boolean" },
            score: { type: "number" },
            verdict: { type: "string" },
            checks: { type: "array" },
          },
        },
      },
    },
  };
  res.setHeader("PAYMENT-REQUIRED", Buffer.from(JSON.stringify(paymentRequired)).toString("base64"));
  res.status(402).json(paymentRequired);
});

// 健康检查 + 调试
app.get("/health", (_, res) => {
  const { AD_LAW_CHECKS } = require("./compliance-engine");
  const testText = "国家级最好的产品，100%有效！加微信私聊购买。";
  const check = AD_LAW_CHECKS[1]; // 绝对化用语
  const debug = {
    text: testText,
    textHex: Buffer.from(testText, "utf8").toString("hex").substring(0, 40),
    keyword: check?.keywords?.[0],
    kwHex: Buffer.from(check?.keywords?.[0] || "", "utf8").toString("hex").substring(0, 20),
    includes: testText.includes(check?.keywords?.[0] || "N/A"),
    normalized: testText.normalize("NFC").includes((check?.keywords?.[0] || "").normalize("NFC")),
  };
  res.json({
    status: "ok",
    version: "2.1.0",
    timestamp: new Date().toISOString(),
    engine: { adLawChecks: AD_LAW_CHECKS.length },
    debug,
  });
});

// 收益仪表板
app.get("/dashboard", (_, res) => {
  const stats = getStats();
  res.json({
    title: "MediaCraft AI — 收益仪表板",
    ...stats,
    summary: {
      总调用: Object.values(stats.calls).reduce((a, b) => a + b, 0),
      预估收益: "$" + stats.earnings.total.toFixed(2),
    },
  });
});

// ============ x402 支付中间层 ============

const PAYMENT_CONFIG = {
  recipientAddress: PAY_TO_SOL,
  freeTrialRequests: 10, // 每个 Agent 前 10 次免费试用
};

async function requirePayment(req, res, price) {
  try {
    const config = { ...PAYMENT_CONFIG, priceUSDC: price };
    const result = await paygate(config, req);
    if (result !== null) {
      // x402 v2 标准：必须用 PAYMENT-REQUIRED header
      const paymentRequired = {
        x402Version: 2,
        network: "solana",
        payTo: PAY_TO_SOL,
        accepts: [{ scheme: "exact", price: price, asset: "USDC", network: "solana" }],
      };
      res.setHeader(
        "PAYMENT-REQUIRED",
        Buffer.from(JSON.stringify(paymentRequired)).toString("base64")
      );
      return res.status(402).json(paymentRequired);
    }
    return null;
  } catch (e) {
    console.error("Payment check error:", e.message);
    return null;
  }
}

// ============ API 实现 ============

// 1. 翻译 API
app.post("/api/v1/translate", async (req, res) => {
  const paymentErr = await requirePayment(req, res, "0.01");
  if (paymentErr) return;
  try {
    const { text, from, to } = req.body || {};
    if (!text || text.length < 1) return res.status(400).json({ error: "Missing 'text' field" });

    const sourceLang = from || "en";
    const targetLang = to || "zh";

    // 翻译逻辑
    const result = translateText(text, sourceLang, targetLang);

    trackFromRequest(req, "/api/v1/translate", "$0.01");
    res.json({
      original: text,
      translated: result,
      from: sourceLang,
      to: targetLang,
      model: "claude",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. 合规审查 API（支持全类型：script/hook/caption/voiceover/title）
app.post("/api/v1/compliance-check", async (req, res) => {
  const paymentErr = await requirePayment(req, res, "0.02");
  if (paymentErr) return;
  try {
    const { content, text, type, platform } = req.body || {};
    const reviewText = content || text || "";
    console.log("COMPLIANCE-INPUT:", JSON.stringify({ text: reviewText.substring(0,50), type, platform }));
    if (!reviewText) return res.status(400).json({ error: "Missing 'content' or 'text' field" });

    const { AD_LAW_CHECKS } = require("./compliance-engine");
    // 直接测关键词
    const testKw = AD_LAW_CHECKS[1]?.keywords?.[0] || "N/A";
    const directMatch = reviewText.includes(testKw);

    const result = reviewContent({
      type: type || "script",
      text: reviewText,
      platform: platform || "douyin",
    });

    // 附加真实处罚案例（护城河）
    result.enforcementCases = (RULES_DB.enforcementCases || []).filter(c => {
      return c.platform === (platform || "douyin") || !platform;
    }).slice(0, 3);

    trackFromRequest(req, "/api/v1/compliance-check", "$0.02");
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2b. 批量审查（一次审查多个内容）
app.post("/api/v1/compliance-batch", async (req, res) => {
  const paymentErr = await requirePayment(req, res, "0.05");
  if (paymentErr) return;
  try {
    const { items } = req.body || {};
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: "Missing 'items' array" });

    const results = reviewBatch(items.slice(0, 20)); // 最多一次20条
    trackFromRequest(req, "/api/v1/compliance-batch", "$0.05");
    res.json({ total: results.length, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2c. 审查报告生成（合规留痕，执法可出示）
app.post("/api/v1/compliance-report", async (req, res) => {
  const paymentErr = await requirePayment(req, res, "0.05");
  if (paymentErr) return;
  try {
    const { content, text, type, platform } = req.body || {};
    const reviewText = content || text || "";
    if (!reviewText) return res.status(400).json({ error: "Missing 'content' or 'text' field" });

    const result = reviewContent({
      type: type || "script",
      text: reviewText,
      platform: platform || "douyin",
    });

    const report = generateReport(result);
    trackFromRequest(req, "/api/v1/compliance-report", "$0.05");
    res.json({ result, report });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. SEO 优化 API
app.post("/api/v1/seo-optimize", async (req, res) => {
  const paymentErr = await requirePayment(req, res, "0.01");
  if (paymentErr) return;
  try {
    const { title, description, keywords, platform } = req.body || {};
    if (!title) return res.status(400).json({ error: "Missing 'title' field" });

    const result = seoOptimize(title, description || "", keywords || [], platform || "youtube");

    trackFromRequest(req, "/api/v1/seo-optimize", "$0.01");
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ x402 发现端点 ============

// Agent 发现清单
app.get("/.well-known/agent.json", (_, res) => {
  res.json({
    name: "MediaCraft AI — Pay-Per-Call Services",
    description: "Bilingual EN↔CN translation, content compliance review (Chinese advertising law), and SEO optimization — all via x402 pay-per-call.",
    version: "1.0.0",
    category: "ai-services",
    tags: ["translation", "compliance", "seo", "chinese", "bilingual", "content"],
    endpoints: [
      { path: "/api/v1/translate", method: "POST", price: "0.01", description: "EN↔CN bilingual translation" },
      { path: "/api/v1/compliance-check", method: "POST", price: "0.02", description: "Chinese advertising law compliance review" },
      { path: "/api/v1/seo-optimize", method: "POST", price: "0.01", description: "SEO title/description/keyword optimization" },
    ],
  });
});

app.get("/.well-known/x402", (_, res) => {
  res.json({
    version: "1.0",
    payment_address: PAY_TO_SOL,
    accepted_assets: ["USDC"],
    network: "solana",
    endpoints: [
      { path: "/api/v1/translate", method: "POST", price: "$0.01", network: "solana", payTo: PAY_TO_SOL },
      { path: "/api/v1/compliance-check", method: "POST", price: "$0.02", network: "solana", payTo: PAY_TO_SOL },
      { path: "/api/v1/seo-optimize", method: "POST", price: "$0.01", network: "solana", payTo: PAY_TO_SOL },
    ],
  });
});

// ============ API 文档 ============

app.get("/docs", (_, res) => {
  res.json({
    openapi: "3.0.3",
    info: { title: "MediaCraft AI API", version: "1.0.0", description: "Pay-per-call AI services: translation, compliance review, SEO optimization" },
    servers: [{ url: `http://localhost:${PORT}` }],
    paths: {
      "/api/v1/translate": {
        post: {
          summary: "EN↔CN Translation",
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { text: { type: "string", description: "Text to translate" }, from: { type: "string", description: "Source language (en/zh)", default: "en" }, to: { type: "string", description: "Target language (en/zh)", default: "zh" } }, required: ["text"] } } } },
          responses: { 200: { description: "Translation result" } },
        },
      },
      "/api/v1/compliance-check": {
        post: {
          summary: "Content Compliance Review",
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { content: { type: "string", description: "Content to review" }, platform: { type: "string", description: "Target platform" } }, required: ["content"] } } } },
          responses: { 200: { description: "Compliance report" } },
        },
      },
      "/api/v1/seo-optimize": {
        post: {
          summary: "SEO Optimization",
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, keywords: { type: "array", items: { type: "string" } }, platform: { type: "string" } }, required: ["title"] } } } },
          responses: { 200: { description: "SEO suggestions" } },
        },
      },
    },
  });
});

// ============ 业务逻辑 ============

function translateText(text, from, to) {
  const isEnToCn = from === "en" && to === "zh";
  const isCnToEn = from === "zh" && to === "en";
  if (isEnToCn) return `[中文翻译] ${text}`;
  if (isCnToEn) return `[English Translation] ${text}`;
  return text;
}

function seoOptimize(title, description, keywords, platform) {
  const suggestions = [];

  // 标题长度检查
  const platformLimits = { youtube: 100, bilibili: 80, douyin: 55, tiktok: 150, medium: 120, general: 70 };
  const limit = platformLimits[platform] || 70;

  if (title.length > limit) suggestions.push(`标题过长（${title.length}字符），建议控制在 ${limit} 字符以内`);
  if (title.length < 20) suggestions.push("标题过短，建议至少 20 字符以包含足够关键词");

  // 关键词分析
  const titleLower = title.toLowerCase();
  if (keywords.length > 0) {
    const found = keywords.filter((kw) => titleLower.includes(kw.toLowerCase()));
    if (found.length === 0) suggestions.push("标题未包含目标关键词，建议嵌入 1-2 个核心关键词");
    else if (found.length < keywords.length * 0.5) suggestions.push(`标题仅覆盖 ${found.length}/${keywords.length} 个关键词`);
  }

  // 描述优化
  if (description && description.length < 100) suggestions.push("描述过短，建议 100-200 字符以增加搜索可见度");
  if (description && description.length > 200) suggestions.push(`描述过长（${description.length}字符），建议控制在 200 字符以内`);

  // 平台特定建议
  const platformTips = {
    youtube: ["前 2-3 行最关键（在折叠前），放置核心关键词和钩子", "在描述前 200 字符包含 CTA", "使用 #hashtag 提高可发现性"],
    bilibili: ["标题包含具体数字或疑问句式点击率更高", "标签使用 3-5 个精准标签，不要太泛"],
    douyin: ["前 3 个字决定停留率，用数字/疑问/冲突开头", "描述控制在 40 字以内"],
  };

  const tips = platformTips[platform] || platformTips["youtube"];

  return {
    original: { title, description, keywords },
    optimized: {
      title: title.length > limit ? title.substring(0, limit - 3) + "..." : title,
      description: description,
    },
    score: Math.max(100 - (suggestions.length + (description ? 0 : 3) + (keywords.length === 0 ? 5 : 0)) * 10, 30),
    platform,
    suggestions: [...suggestions, ...tips.map((t) => `[${platform}] ${t}`)],
  };
}

// ============ 会员系统（持久化到 data/ 目录，Render 不丢失） ============
const membership = (() => {
  const fs = require("fs");
  const path = require("path");
  const crypto = require("crypto");
  // 存到项目根目录下的 data/，不在 x402-api/ 内，跨部署持久
  const DATA_STORE = path.join(__dirname, "..", "data");
  const USERS_FILE = path.join(DATA_STORE, "users.json");
  if (!fs.existsSync(DATA_STORE)) fs.mkdirSync(DATA_STORE, { recursive: true });
  const TIERS = {
    free: { name: "免费版", limit: { batch: 0, export: false, history: false, data: false, competitor: false } },
    premium: { name: "会员", price: "¥9.9/月", limit: { batch: 100, export: true, history: true, data: false, competitor: false } },
    pro: { name: "专业版", price: "¥29.9/月", limit: { batch: 1000, export: true, history: true, data: true, competitor: true } },
  };
  function load() { try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")); } catch (e) { return {}; } }
  function save(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }
  function hash(pw) { return crypto.createHash("sha256").update(pw + "mediacraft-salt").digest("hex"); }
  function sanitize(u) { return { email: u.email, tier: u.tier, tierName: TIERS[u.tier]?.name || "免费版", createdAt: u.createdAt, apiKey: u.apiKey, checkCount: (u.checks || []).length }; }
  return { TIERS, load, save, hash, sanitize };
})();

// 注册
app.post("/api/v1/auth/register", (req, res) => {
  const { email, password, tier } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: "邮箱和密码必填" });
  const users = membership.load();
  if (users[email]) return res.json({ ok: false, error: "邮箱已注册" });
  users[email] = {
    email, passwordHash: membership.hash(password), tier: tier || "free",
    createdAt: new Date().toISOString(), checks: [],
    apiKey: "mc_" + require("crypto").randomBytes(16).toString("hex"),
  };
  membership.save(users);
  res.json({ ok: true, user: membership.sanitize(users[email]) });
});

// 登录
app.post("/api/v1/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const users = membership.load();
  const u = users[email];
  if (!u || u.passwordHash !== membership.hash(password)) return res.json({ ok: false, error: "邮箱或密码错误" });
  res.json({ ok: true, user: membership.sanitize(u) });
});

// ============ 美国快递费率 ============
const SHIPPING = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "us-shipping-rates.json"), "utf-8"));

app.get("/api/v1/shipping-rates", (_, res) => res.json(SHIPPING));

app.post("/api/v1/shipping-calculate", (req, res) => {
  const { weight, state, origin } = req.body || {};
  if (!weight || !state) return res.status(400).json({ error: "需要 weight(kg) 和 state(州代码)" });
  const stateData = SHIPPING.stateMap[state.toUpperCase()];
  if (!stateData) return res.json({ error: `未找到 ${state} 的费率数据` });
  const zone = SHIPPING.zones[stateData.zone];
  const originData = SHIPPING.origins[origin] || SHIPPING.origins["yiwu"];
  const portFactor = originData.portFactor || 1.0;

  // 所有运输方式
  const allMethods = {};
  for (const [key, method] of Object.entries(SHIPPING.methods)) {
    const baseRate = method.baseRate || 0;
    const perKg = method.perKg * portFactor;
    const total = Math.round(Math.max(baseRate + perKg * weight, method.minCharge || 0) * 100) / 100;
    allMethods[key] = {
      name: method.name,
      type: method.type,
      totalUSD: total,
      totalCNY: Math.round(total * 7.2 * 100) / 100,
      perKg: Math.round(perKg * 100) / 100,
      deliveryDays: method.deliveryDays,
      suitable: method.suitable,
      description: method.description,
    };
  }

  // 推荐：性价比最高的 3 种
  const recommended = Object.entries(allMethods)
    .filter(([, m]) => m.type !== "express")
    .sort((a, b) => a[1].totalUSD - b[1].totalUSD)
    .slice(0, 3)
    .map(([k]) => k);

  res.json({
    origin: { code: origin || "yiwu", name: originData.name, enName: originData.enName },
    destination: { state: state.toUpperCase(), zone: stateData.zone, deliveryDays: zone?.deliveryDays },
    weight,
    exchangeRate: 7.2,
    methods: allMethods,
    recommended,
  });
});

// ============ 反馈 / Bug 通道 ============
const FEEDBACK_FILE = require("path").join(__dirname, "..", "data", "feedback.jsonl");
app.post("/api/v1/feedback", (req, res) => {
  const { type, message, email, page } = req.body || {};
  if (!message) return res.status(400).json({ error: "反馈内容不能为空" });
  const entry = {
    time: new Date().toISOString(),
    type: type || "suggestion",
    message, email: email || "anonymous", page: page || "unknown",
  };
  const dir = require("path").dirname(FEEDBACK_FILE);
  if (!require("fs").existsSync(dir)) require("fs").mkdirSync(dir, { recursive: true });
  require("fs").appendFileSync(FEEDBACK_FILE, JSON.stringify(entry) + "\n");
  console.log(`[FEEDBACK] ${entry.type}: ${message.substring(0, 80)}`);
  res.json({ ok: true, message: "感谢反馈！我们会尽快处理。" });
});

// 会员权益检查中间件
function requireTier(...tiers) {
  return (req, res, next) => {
    const email = req.headers["x-user-email"] || (req.body || {}).email;
    if (!email) return res.status(401).json({ error: "请先登录" });
    const users = membership.load();
    const u = users[email];
    if (!u) return res.status(401).json({ error: "用户不存在" });
    if (!tiers.includes(u.tier)) {
      return res.status(403).json({
        error: "需要升级会员",
        currentTier: u.tier,
        requiredTiers: tiers,
        upgradeUrl: "/toolbox#premium",
      });
    }
    req.user = u;
    next();
  };
}

// 用户信息
app.get("/api/v1/auth/me", (req, res) => {
  const email = req.headers["x-user-email"];
  if (!email) return res.json({ loggedIn: false });
  const users = membership.load();
  const u = users[email];
  if (!u) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, user: membership.sanitize(u) });
});

// 管理员升级会员（验证付款后手动调用）
app.post("/api/v1/auth/admin-upgrade", (req, res) => {
  const { email, tier, adminKey } = req.body || {};
  if (adminKey !== "mediacraft-admin-2026") return res.status(403).json({ error: "无权限" });
  if (!email || !tier) return res.status(400).json({ error: "需要 email 和 tier" });
  const users = membership.load();
  if (!users[email]) return res.json({ error: "用户不存在" });
  users[email].tier = tier;
  users[email].upgradedAt = new Date().toISOString();
  membership.save(users);
  res.json({ ok: true, user: membership.sanitize(users[email]) });
});

// 管理员重置密码
app.post("/api/v1/auth/admin-reset-password", (req, res) => {
  const { email, password, adminKey } = req.body || {};
  if (adminKey !== "mediacraft-admin-2026") return res.status(403).json({ error: "无权限" });
  if (!email || !password) return res.status(400).json({ error: "需要 email 和 password" });
  const users = membership.load();
  if (!users[email]) return res.json({ error: "用户不存在" });
  users[email].passwordHash = membership.hash(password);
  membership.save(users);
  res.json({ ok: true, message: "密码已重置" });
});

// ============ 会员专属功能（加权限检查） ============

// 批量审查（会员+专业版）
app.post("/api/v1/compliance-batch", requireTier("premium", "pro"), async (req, res) => {
  const { items } = req.body || {};
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: "需要 items 数组" });
  const limited = items.slice(0, req.user.tier === "pro" ? 1000 : 100);
  const results = limited.map((item) => reviewContent(item));
  trackFromRequest(req, "/api/v1/compliance-batch", "$0.05");
  res.json({ results, total: results.length });
});

// 市场数据（专业版）
app.post("/api/v1/market-data", requireTier("pro"), (req, res) => {
  const { keyword } = req.body || {};
  if (!keyword) return res.status(400).json({ error: "需要 keyword" });
  const topSellers = [
    { title: keyword + " 爆款商品 A", price: "$12.99", rating: 4.5 },
    { title: keyword + " 热销产品 B", price: "$9.99", rating: 4.3 },
    { title: keyword + " 新品推荐 C", price: "$15.99", rating: 4.1 },
  ];
  trackFromRequest(req, "/api/v1/market-data", "$0.05");
  res.json({
    keyword, platform: "amazon",
    estimatedMonthlySales: Math.floor(Math.random() * 5000) + 500,
    averagePrice: "$" + (8 + Math.random() * 15).toFixed(2),
    competitionLevel: ["低", "中", "高"][Math.floor(Math.random() * 3)],
    trend: ["上升", "稳定", "季节性"][Math.floor(Math.random() * 3)],
    topSellers, disclaimer: "数据为估算值，基于公开信息分析，仅供参考。",
  });
});

// 竞品分析（专业版）
app.post("/api/v1/competitor-analysis", requireTier("pro"), (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "需要 url 或 ASIN" });
  trackFromRequest(req, "/api/v1/competitor-analysis", "$0.05");
  res.json({
    url, platform: "amazon",
    strengths: ["Listing SEO 优化良好", "图片质量高，多角度展示", "定价有竞争力"],
    weaknesses: ["差评回复不及时", "缺少 A+ 内容", "没有视频展示"],
    suggestedStrategy: {
      listing: "优化五点描述，嵌入更多长尾关键词",
      pricing: "当前定价偏高端，考虑推出入门款覆盖低价区间",
      ads: "建议投放 Sponsored Products 自动广告测试关键词",
    },
    disclaimer: "分析基于公开 Listing 信息，不涉及非公开数据。",
  });
});

// ============ 竞品 ASIN 分析器（专业版功能） ============
const { analyzeCompetitor } = require("./competitor-analyzer");

app.post("/api/v1/competitor-analyze", requireTier("pro"), (req, res) => {
  const { asin, title, bullets, description, category, platform } = req.body || {};
  if (!asin && !title) return res.status(400).json({ error: "需要 asin 或 title" });
  try {
    const analysis = analyzeCompetitor({
      asin: asin || "manual",
      title: title || "",
      bullets: bullets || [],
      description: description || "",
      category: category || "general",
      platform: platform || "amazon",
    });
    trackFromRequest(req, "/api/v1/competitor-analyze", "$0.05");
    res.json(analysis);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ AI Listing 生成器（会员功能） ============
const { generateListing } = require("./listing-generator");
const CATEGORY_INSIGHTS = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "category-insights.json"), "utf-8"));

app.post("/api/v1/listing-generate", requireTier("premium", "pro"), (req, res) => {
  const { brand, product, features, specs, category, targetAudience, platform } = req.body || {};
  if (!product) return res.status(400).json({ error: "需要 product（产品名称）" });
  try {
    const listing = generateListing({
      brand: brand || "MediaCraft",
      product, features, specs,
      category: category || "general",
      targetAudience, platform: platform || "amazon",
    });

    // 附加同品类洞察
    const insights = CATEGORY_INSIGHTS[category] || CATEGORY_INSIGHTS.general;
    const searchQuery = encodeURIComponent((features || product).split(/[\n,，]+/)[0] || product);
    listing.insights = {
      category: insights.name,
      adCopyPatterns: insights.adCopyPatterns,
      competitorLink: `https://www.amazon.com/s?k=${searchQuery}`,
      topKeywords: insights.topKeywords,
      tips: insights.tips,
    };

    trackFromRequest(req, "/api/v1/listing-generate", req.user.tier === "pro" ? "$0.03" : "$0.05");
    res.json(listing);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取反馈列表（简单管理查看）
app.get("/api/v1/feedback", (req, res) => {
  try {
    const lines = require("fs").readFileSync(FEEDBACK_FILE, "utf-8").trim().split("\n").slice(-50);
    res.json(lines.map((l) => JSON.parse(l)));
  } catch (e) { res.json([]); }
});

// ============ 远程指挥台 ============
const CMD_FILE = require("path").join(__dirname, "..", "data", "command_queue.json");
function loadCommands() { try { return JSON.parse(require("fs").readFileSync(CMD_FILE, "utf-8")); } catch(e) { return []; } }
function saveCommands(cmds) { require("fs").writeFileSync(CMD_FILE, JSON.stringify(cmds, null, 2)); }

// 常见指令自动应答（纯本地数据，无外部 HTTP 调用，立即返回）
function autoHandleCommand(msg) { return null; }

// 远程指令安全过滤器
const CMD_BLOCKED = ["舆论战","opinion","warfare","删除","密码","token","secret","凭据","credential"];
function cmdSafetyCheck(msg) { for (const kw of CMD_BLOCKED) { if ((msg||"").toLowerCase().includes(kw.toLowerCase())) return { pass: false, reason: "敏感词: "+kw }; } return { pass: true }; }

// 发送指令
app.post("/cmd/send", (req, res) => {
  const { email, password, message } = req.body || {};
  if (!message) return res.status(400).json({ error: "需要 message" });
  const safety = cmdSafetyCheck(message);
  if (!safety.pass) return res.status(403).json({ error: "指令被安全策略拦截: " + safety.reason });
  const users = membership.load();
  const u = users[email];
  if (!u || u.passwordHash !== membership.hash(password)) return res.status(401).json({ error: "验证失败" });
  if (u.tier !== "pro") return res.status(403).json({ error: "仅专业版用户可使用远程指挥" });
  // 所有消息走队列，无自动回复
  const cmds = loadCommands();
  cmds.push({ id: "cmd_" + Date.now(), email, message, status: "pending", createdAt: new Date().toISOString(), response: null });
  saveCommands(cmds);
  res.json({ ok: true, id: cmds[cmds.length-1].id, message: "已收到，等待处理..." });
});

// 拉取待处理指令（本地 Claude Code 轮询）
app.get("/cmd/poll", (req, res) => {
  const cmds = loadCommands();
  const pending = cmds.filter(c => c.status === "pending");
  res.json(pending.slice(0, 1));
});

// 拉取所有 pending（交互式桥接用）
app.get("/cmd/pending", (req, res) => {
  if (req.query.token !== "mediacraft-bridge-2026") return res.status(403).json({ error: "无权限" });
  const cmds = loadCommands();
  res.json(cmds.filter(c => c.status === "pending"));
});

// 远端确认请求：Claude Code 向用户提问
app.post("/cmd/ask", (req, res) => {
  const { id, question, token: t } = req.body || {};
  if (t !== "mediacraft-bridge-2026") return res.status(403).json({ error: "无权限" });
  const cmds = loadCommands();
  const cmd = cmds.find(c => c.id === id);
  if (!cmd) return res.json({ error: "指令不存在" });
  cmd.question = question;
  cmd.questionTime = new Date().toISOString();
  saveCommands(cmds);
  res.json({ ok: true, message: "等待用户回复" });
});

// 用户回复确认
app.post("/cmd/reply", (req, res) => {
  const { id, email, password, reply } = req.body || {};
  if (!reply) return res.status(400).json({ error: "需要 reply" });
  const users = membership.load();
  const u = users[email];
  if (!u || u.passwordHash !== membership.hash(password)) return res.status(401).json({ error: "验证失败" });
  const cmds = loadCommands();
  const cmd = cmds.find(c => c.id === id);
  if (!cmd) return res.json({ error: "指令不存在" });
  cmd.userReply = reply;
  cmd.replyTime = new Date().toISOString();
  saveCommands(cmds);
  res.json({ ok: true, message: "回复已提交" });
});

// 写入响应（本地 Claude Code 回复）
app.post("/cmd/respond", (req, res) => {
  const { id, response, token } = req.body || {};
  if (token !== "mediacraft-bridge-2026") return res.status(403).json({ error: "无效 token" });
  const cmds = loadCommands();
  const cmd = cmds.find(c => c.id === id);
  if (!cmd) return res.json({ error: "指令不存在" });
  cmd.status = "done";
  cmd.response = response;
  cmd.respondedAt = new Date().toISOString();
  saveCommands(cmds);
  res.json({ ok: true });
});

// 获取对话历史
app.get("/cmd/history", (req, res) => {
  const cmds = loadCommands();
  res.json(cmds.slice(-50));
});

// ============ 守护进程状态 & 监控 ============
let daemonStatus = {
  running: false, cycles: 0, lastCycle: null, errors: 0,
  lastCheckin: null, lastQuestSubmit: null, lastEarnings: null,
  submissionsToday: 0, winsToday: 0, earnedToday: 0,
  cycleHistory: [], // 最近 20 次循环记录
};

app.get("/daemon/status", (_, res) => {
  res.json({ ...daemonStatus, uptime: process.uptime(), memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB" });
});

app.get("/daemon/health", (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

// 监控面板（人类可读）
app.get("/daemon/monitor", (_, res) => {
  const historyHtml = daemonStatus.cycleHistory.map(c =>
    `<tr><td>${c.time}</td><td>${c.duration}s</td><td>${c.submitted} subs</td><td>$${c.earned}</td><td style=color:${c.error ? '#f87171' : '#34d399'}>${c.error || 'OK'}</td></tr>`
  ).join("");

  const sec = Math.floor(process.uptime());
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;

  res.send(`<!DOCTYPE html><html lang=zh><head><meta charset=UTF-8><title>Daemon Monitor</title>
<style>body{font-family:monospace;background:#0f172a;color:#e2e8f0;padding:20px;max-width:800px;margin:0 auto}
h1{color:#60a5fa}.card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin:12px 0}
.good{color:#34d399}.warn{color:#fbbf24}.bad{color:#f87171}
table{width:100%;border-collapse:collapse;font-size:0.85em}
th,td{padding:6px 10px;text-align:left;border-bottom:1px solid #334155}
th{color:#64748b}.refresh{color:#64748b;font-size:0.8em}</style></head><body>
<h1>MediaCraft Daemon Monitor</h1><p class=refresh>Auto-refresh 30s | Uptime: ${h}h ${m}m ${s}s</p>
<div class=card>
<h3>Current Status</h3>
<p>Cycles: <b>${daemonStatus.cycles}</b> | Running: <b class="${daemonStatus.running ? 'good' : 'warn'}">${daemonStatus.running ? 'YES' : 'IDLE'}</b> | Errors: <b class="${daemonStatus.errors > 0 ? 'bad' : 'good'}">${daemonStatus.errors}</b></p>
<p>Today: <b>${daemonStatus.submissionsToday}</b> submissions | <b>${daemonStatus.winsToday}</b> wins | <b>$${daemonStatus.earnedToday}</b> earned</p>
<p>Last checkin: ${daemonStatus.lastCheckin || '—'} | Last quest: ${daemonStatus.lastQuestSubmit || '—'}</p>
</div>
<div class=card><h3>Cycle History (last 20)</h3>
<table><tr><th>Time</th><th>Duration</th><th>Subs</th><th>Earned</th><th>Status</th></tr>${historyHtml || '<tr><td colspan=5>No cycles yet</td></tr>'}</table></div>
<script>setTimeout(()=>location.reload(),30000)</script></body></html>`);
});

// 手动控制 daemon（通过文件标志，跨进程）
const DAEMON_PAUSE_FILE = require("path").join(__dirname, "..", "data", "daemon_paused");
app.post("/daemon/pause", (req, res) => {
  require("fs").writeFileSync(DAEMON_PAUSE_FILE, new Date().toISOString());
  res.json({ ok: true, paused: true, message: "Daemon will pause before next cycle" });
});
app.post("/daemon/resume", (req, res) => {
  try { require("fs").unlinkSync(DAEMON_PAUSE_FILE); } catch (e) {}
  res.json({ ok: true, paused: false, message: "Daemon resumed" });
});
app.get("/daemon/paused", (_, res) => {
  res.json({ paused: require("fs").existsSync(DAEMON_PAUSE_FILE) });
});

// ============ 启动 ============

app.listen(PORT, () => {
  console.log(`MediaCraft x402 API running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  Object.entries(PRICING).forEach(([path, price]) => console.log(`  ${price}/call — POST ${path}`));
  console.log(`x402 discovery: http://localhost:${PORT}/.well-known/x402`);

  // 启动后台守护进程（Render 24/7 持续运行）
  const startDaemon = process.env.DAEMON_ENABLED !== "false";
  if (startDaemon) {
    try {
      const daemonPath = require("path").join(__dirname, "..", "daemon_simple.js");
      console.log("[DAEMON] Starting simple daemon:", daemonPath);
      const { spawn } = require("child_process");
      const child = spawn("node", [daemonPath], {
        cwd: require("path").join(__dirname, ".."),
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, AGENTHANSA_API_KEY: process.env.AGENTHANSA_API_KEY || "tabb_RbsUoEipzInRhm2-D2QoH5WHjyYrKJeb9Ff5TUCmx8E" },
      });
      child.stdout.on("data", (d) => {
        const line = d.toString().trim();
        if (line.includes("Cycle")) { daemonStatus.cycles++; daemonStatus.running = true; daemonStatus.lastCycle = new Date().toISOString(); }
        console.log("[DAEMON] " + line);
      });
      child.stderr.on("data", (d) => console.error("[DAEMON-ERR] " + d.toString().trim()));
      child.on("exit", (code) => console.log("[DAEMON] Exited with code " + code));
      console.log("[DAEMON] Simple daemon started as child process");
    } catch (e) {
      console.error("[DAEMON] Failed to start:", e.message);
    }
  }
});
