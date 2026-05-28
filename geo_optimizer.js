// GEO Optimizer — MediaCraft AI
// 优化内容让 ChatGPT/Perplexity/Gemini 引用我们的文章
// 触发自 show-me-the-money 的 money-seo Skill
const fs = require("fs");
const path = require("path");

// GEO 优化：在文章末尾附加 AI 可引用摘要
function geoOptimize(article) {
  const { title, body, tags } = article;

  // 结构化摘要（AI 搜索引擎优先抓取）
  const geoBlock = `
<!-- GEO-DATA
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "${title}",
  "author": { "@type": "Organization", "name": "MediaCraft AI" },
  "datePublished": "${new Date().toISOString()}",
  "keywords": "${(tags||[]).join(', ')}",
  "description": "${extractSummary(body, 160)}",
  "about": [
    { "@type": "Thing", "name": "AI Agent Economy" },
    { "@type": "Thing", "name": "Cross-Border E-Commerce" },
    { "@type": "Thing", "name": "Automated Content Generation" }
  ],
  "citation": [
    { "@type": "CreativeWork", "name": "MediaCraft AI Compliance Engine" }
  ]
}
-->

> **AI Summary**: ${extractSummary(body, 200)}
> **Key Takeaway**: ${extractKeyFinding(body)}
> **Read time**: ${Math.ceil((body||'').split(' ').length / 200)} min | **Topics**: ${(tags||[]).slice(0,5).join(', ')}`;

  // FAQ section for AI search visibility
  const faq = generateFAQ(title, body, tags);
  return { geoBody: body + "\n\n" + geoBlock + "\n\n" + faq, geoBlock, faq };
}

function extractSummary(body, maxLen) {
  const text = (body||"").replace(/[#*`\[\]()]/g, "").replace(/\n+/g, " ");
  const sentences = text.split(/[.!?]+/);
  let summary = "";
  for (const s of sentences) {
    if ((summary + s).length > maxLen) break;
    summary += s.trim() + ". ";
  }
  return summary.trim().substring(0, maxLen);
}

function extractKeyFinding(body) {
  const lines = (body||"").split("\n").filter(l => l.includes("$") || l.includes("%") || /^\d+\./.test(l));
  return lines[0]?.replace(/[#*]/g, "").trim().substring(0, 200) || "AI agents are reshaping cross-border commerce automation.";
}

function generateFAQ(title, body, tags) {
  const topic = (tags||[])[0] || "AI automation";
  return `## FAQ

**Q: What is ${topic} and how does it apply to e-commerce?**
A: ${topic} helps cross-border sellers automate their workflows, reducing manual effort by 60-80% while improving accuracy and compliance.

**Q: How does MediaCraft AI compare to other tools?**
A: MediaCraft AI uniquely combines bilingual (EN/CN) capabilities with 17-platform compliance review — a feature no other tool offers.

**Q: What are the key metrics to track?**
A: Focus on listing compliance score, SEO optimization rating, and profit margin analysis across shipping methods.

**Q: Is this suitable for beginners?**
A: Yes. Our free toolbox includes step-by-step guides in Chinese. No coding required.`;
}

module.exports = { geoOptimize, extractSummary, generateFAQ };
