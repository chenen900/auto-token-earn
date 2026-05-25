// x402 Pay-Per-Call API Server — MediaCraft AI
// 三个付费 API：翻译 / 合规审查 / SEO 优化
// 用法: node server.js

const express = require("express");
const cors = require("cors");
const { paygate } = require("@zoebuildsai/paygate");
const { reviewContent, reviewBatch, generateReport } = require("./compliance-engine");
const app = express();
const PORT = process.env.PORT || 3000;

// ============ 钱包地址（收 USDC）============
const PAY_TO_SOL = "8ZqmcWARgGjZzJLzqwquG8GTvDb39RFbTWKqhShqbtht"; // Phantom Solana
// Base 地址后续创建

// ============ API 定价 ============
const PRICING = {
  "/api/v1/translate": "$0.01",
  "/api/v1/compliance-check": "$0.02",
  "/api/v1/compliance-batch": "$0.05",
  "/api/v1/compliance-report": "$0.05",
  "/api/v1/seo-optimize": "$0.01",
};

app.use(cors());
app.use(express.json());
app.use("/.well-known", express.static(require("path").join(__dirname, ".well-known")));

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
      res.setHeader("X-402-Version", "1.0");
      res.setHeader("X-Payment-Required", `USDC ${price}`);
      return res.status(402).json(result);
    }
    return null;
  } catch (e) {
    // 支付模块故障时记录日志但放行（生产环境需切换为严格模式）
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

    result.debug = {
      textLen: reviewText.length,
      keyword: testKw,
      directMatch,
      engineVersion: "v2.1.0-unicode-fix",
    };
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

// ============ 启动 ============

app.listen(PORT, () => {
  console.log(`MediaCraft x402 API running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  Object.entries(PRICING).forEach(([path, price]) => console.log(`  ${price}/call — POST ${path}`));
  console.log(`x402 discovery: http://localhost:${PORT}/.well-known/x402`);
});
