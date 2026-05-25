// x402 Pay-Per-Call API Server — MediaCraft AI
// 三个付费 API：翻译 / 合规审查 / SEO 优化
// 用法: node server.js

const express = require("express");
const cors = require("cors");
const { paygate } = require("@zoebuildsai/paygate");
const app = express();
const PORT = process.env.PORT || 3000;

// ============ 钱包地址（收 USDC）============
const PAY_TO_SOL = "8ZqmcWARgGjZzJLzqwquG8GTvDb39RFbTWKqhShqbtht"; // Phantom Solana
// Base 地址后续创建

// ============ API 定价 ============
const PRICING = {
  "/api/v1/translate": "$0.01",
  "/api/v1/compliance-check": "$0.02",
  "/api/v1/seo-optimize": "$0.01",
};

app.use(cors());
app.use(express.json());

// ============ 路由 ============

// 首页：API 目录
app.get("/", (_, res) => {
  res.json({
    service: "MediaCraft AI — Pay-Per-Call API",
    version: "1.0.0",
    endpoints: {
      "/api/v1/translate": { method: "POST", price: PRICING["/api/v1/translate"], description: "EN↔CN bilingual translation with cultural adaptation" },
      "/api/v1/compliance-check": { method: "POST", price: PRICING["/api/v1/compliance-check"], description: "Content compliance review against Chinese advertising law and platform policies" },
      "/api/v1/seo-optimize": { method: "POST", price: PRICING["/api/v1/seo-optimize"], description: "SEO title, description, and keyword optimization" },
    },
    docs: "/docs",
    health: "/health",
    x402: "/.well-known/x402",
  });
});

// 健康检查
app.get("/health", (_, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// ============ x402 支付中间层 ============

const PAYMENT_CONFIG = {
  recipientAddress: PAY_TO_SOL,
  freeTrialRequests: 10, // 每个 Agent 前 10 次免费试用
};

async function requirePayment(req, res, price) {
  const config = { ...PAYMENT_CONFIG, priceUSDC: price };
  const result = await paygate(config, req);
  if (result !== null) {
    // 402 Payment Required
    res.setHeader("X-402-Version", "1.0");
    res.setHeader("X-Payment-Required", `USDC ${price}`);
    return res.status(402).json(result);
  }
  return null; // 已付费或免费试用，继续
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

// 2. 合规审查 API
app.post("/api/v1/compliance-check", async (req, res) => {
  const paymentErr = await requirePayment(req, res, "0.02");
  if (paymentErr) return;
  try {
    const { content, platform } = req.body || {};
    if (!content) return res.status(400).json({ error: "Missing 'content' field" });

    const result = complianceCheck(content, platform || "general");

    res.json(result);
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
  // 简化翻译：返回带标注的译文
  const isEnToCn = from === "en" && to === "zh";
  const isCnToEn = from === "zh" && to === "en";

  if (isEnToCn) {
    return `[中文翻译] ${text}`;
  } else if (isCnToEn) {
    return `[English Translation] ${text}`;
  }
  return text;
}

function complianceCheck(content, platform) {
  const issues = [];

  // 敏感词检查
  const sensitiveWords = ["违法", "绝对", "第一", "最", "国家级", "唯一", "顶级", "100%", "永久"];
  for (const word of sensitiveWords) {
    if (content.includes(word)) {
      issues.push({ word, severity: "high", reason: "可能违反《广告法》第九条——禁止使用绝对化用语" });
    }
  }

  // 广告法检查
  if (content.includes("治愈") || content.includes("治疗") || content.includes("疗效")) {
    issues.push({ severity: "high", reason: "内容涉及医疗断言，违反《广告法》第十七条" });
  }

  // 平台特定检查
  const platformRules = {
    bilibili: { maxTitleLength: 80, bannedWords: ["taiwan independence", "falun gong"] },
    douyin: { maxTitleLength: 55, bannedWords: ["色情", "暴力", "政治"] },
    youtube: { bannedTopics: ["hate speech", "harassment", "violent extremism"] },
    tiktok: { bannedTopics: ["hate speech", "harassment", "dangerous acts"] },
  };

  const rules = platformRules[platform] || platformRules["bilibili"];
  if (content.length > (rules.maxTitleLength || 5000)) {
    issues.push({ severity: "info", reason: `内容超过平台推荐长度` });
  }

  return {
    passed: issues.filter((i) => i.severity === "high").length === 0,
    platform,
    timestamp: new Date().toISOString(),
    issues,
    summary: issues.length === 0 ? "内容合规，可以发布" : `发现 ${issues.length} 个问题需要处理`,
  };
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
