#!/usr/bin/env node
// Daily Report — 每日 A 线战报生成器
// 用法: node scripts/daily_report.js [--all] [--markdown]
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const REPORT_DIR = path.join(ROOT, "data", "reports");

// 动态加载 lib 模块
const bidTracker = require(path.join(ROOT, "lib", "bid_tracker.js"));
const questPipeline = require(path.join(ROOT, "lib", "quest_pipeline.js"));

function generate(options = {}) {
  const todayOnly = !options.all;
  const analytics = bidTracker.analyze(todayOnly);
  const pipelineStats = questPipeline.stats();
  const s = analytics.summary;

  const report = [];

  report.push("# 🎯 MediaCraft A线 战报");
  report.push("");
  report.push(`> 生成时间: ${analytics.generatedAt}`);
  report.push(`> 统计范围: ${analytics.period === "today" ? "今日" : "全部历史"}`);
  report.push("");

  // ====== 核心指标 ======
  report.push("## 📊 核心指标");
  report.push("");
  report.push("| 指标 | 数值 |");
  report.push("|------|------|");
  report.push(`| 今日投标 | **${s.totalBids}** 次 |`);
  report.push(`| 胜出 | **${s.won}** 次 |`);
  report.push(`| 失败 | **${s.lost}** 次 |`);
  report.push(`| 待定 | ${s.pending} 次 |`);
  report.push(`| 胜率 | **${s.winRate}%** |`);
  report.push(`| 今日收益 | **$${s.totalEarnedToday}** |`);
  report.push(`| 累计收益 | **$${s.allTimeEarned}** |`);
  report.push(`| 平均赏金/标 | $${s.avgRewardPerBid} |`);
  report.push("");

  // ====== 管线状态 ======
  report.push("## 🔄 任务管线");
  report.push("");
  report.push("| 阶段 | 数量 |");
  report.push("|------|------|");
  report.push(`| 📥 待处理 | ${pipelineStats.inbox_pending} |`);
  report.push(`| ✅ 已回复待提交 | ${pipelineStats.outbox_ready} |`);
  report.push(`| 📤 已提交等结果 | ${pipelineStats.outbox_submitted} |`);
  report.push(`| 📦 已归档 | ${pipelineStats.archived} |`);
  report.push("");

  // ====== 分类胜率 ======
  if (Object.keys(analytics.byCategory).length > 0) {
    report.push("## 📂 分类胜率");
    report.push("");
    report.push("| 类别 | 投标 | 胜 | 负 | 胜率 | 赏金 |");
    report.push("|------|------|----|----|------|------|");
    for (const [cat, data] of Object.entries(analytics.byCategory)) {
      const wr = data.bids > 0 ? Math.round(data.won / data.bids * 100) : 0;
      report.push(`| ${cat} | ${data.bids} | ${data.won} | ${data.lost} | ${wr}% | $${data.potentialReward} |`);
    }
    report.push("");
  }

  // ====== 响应类型对比 ======
  if (Object.keys(analytics.byResponseType).length > 0) {
    report.push("## 🎨 响应类型对比");
    report.push("");
    report.push("| 类型 | 投标 | 胜 | 胜率 |");
    report.push("|------|------|----|------|");
    for (const [type, data] of Object.entries(analytics.byResponseType)) {
      const wr = data.bids > 0 ? Math.round(data.won / data.bids * 100) : 0;
      report.push(`| ${type} | ${data.bids} | ${data.won} | ${wr}% |`);
    }
    report.push("");
  }

  // ====== 质量门禁 ======
  const qg = analytics.qualityGating;
  if (qg.total > 0) {
    report.push("## 🛡️ 质量门禁");
    report.push("");
    report.push(`- 检查次数: ${qg.total}`);
    report.push(`- 通过: ${qg.passed} | 拦截: ${qg.failed}`);
    report.push(`- 平均分: ${qg.avgScore}/100`);
    report.push("");
  }

  // ====== 最近投标 ======
  if (analytics.recentBids.length > 0) {
    report.push("## 📋 最近投标");
    report.push("");
    report.push("| 任务 | 类别 | 赏金 | 响应类型 | 结果 |");
    report.push("|------|------|------|----------|------|");
    for (const b of analytics.recentBids.slice(-10).reverse()) {
      const resultEmoji = b.result === "won" ? "🏆" : b.result === "lost" ? "❌" : "⏳";
      report.push(`| ${(b.title || "").substring(0, 40)} | ${b.category} | $${b.reward} | ${b.responseType} | ${resultEmoji} ${b.result} |`);
    }
    report.push("");
  }

  // ====== 收益明细 ======
  const ledger = bidTracker.readLedger(todayOnly ? 50 : 200);
  if (ledger.length > 0) {
    report.push("## 💰 收益明细");
    report.push("");
    const todayLedger = todayOnly
      ? ledger.filter(e => (e.time || "").startsWith(new Date().toISOString().substring(0, 10)))
      : ledger;
    if (todayLedger.length > 0) {
      report.push("| 来源 | 金额 | 时间 |");
      report.push("|------|------|------|");
      for (const e of todayLedger.slice(-10).reverse()) {
        report.push(`| ${e.source} | $${e.amount} | ${(e.time || "").substring(11, 19)} |`);
      }
      report.push("");
    }
  }

  // ====== 建议 ======
  report.push("## 💡 AI 建议");
  report.push("");

  if (s.totalBids === 0) {
    report.push("- ⚠️ **今日零投标** — 检查 AgentHansa 是否有新 Quest，或 daemon 是否在线");
  }
  if (s.winRate === 0 && s.totalBids > 0) {
    report.push("- 🔴 **胜率 0%** — 响应质量需要紧急提升。优先使用 AI 生成回复，禁用模板提交");
  }
  if (s.winRate > 0 && s.winRate < 20) {
    report.push("- 🟡 **胜率偏低** — 重点分析输掉的标，找出共同模式，调整策略");
  }

  // 分类建议
  for (const [cat, data] of Object.entries(analytics.byCategory)) {
    if (data.bids >= 3 && data.won === 0) {
      report.push(`- 🚫 **${cat} 类连续 ${data.bids} 次零胜** — 暂时停止投标此类，节省配额`);
    }
    if (data.bids >= 3 && data.won / data.bids > 0.25) {
      report.push(`- ✅ **${cat} 类胜率 >25%** — 加大此类投标力度`);
    }
  }

  // 响应类型建议
  for (const [type, data] of Object.entries(analytics.byResponseType)) {
    if (type === "template" && data.bids > 5 && data.won === 0) {
      report.push("- 🔴 **模板响应零胜率** — 立即停止使用模板，所有任务转 AI 处理管线");
    }
  }

  report.push("");
  report.push("---");
  report.push(`*Report generated by MediaCraft AI Bid Tracker v1.0*`);

  const text = report.join("\n");

  // 保存到文件
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const filename = `report_${new Date().toISOString().substring(0, 10)}.md`;
  const filepath = path.join(REPORT_DIR, filename);
  fs.writeFileSync(filepath, text);

  return { text, filepath };
}

// ====== CLI ======
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    all: args.includes("--all"),
    markdown: args.includes("--markdown")
  };

  const { text, filepath } = generate(options);

  if (options.markdown) {
    console.log(text);
  } else {
    // 纯文本摘要
    const analytics = bidTracker.analyze(!options.all);
    const s = analytics.summary;
    console.log("=== MediaCraft A线 战报 ===");
    console.log(`投标: ${s.totalBids} | 胜: ${s.won} | 负: ${s.lost} | 胜率: ${s.winRate}%`);
    console.log(`今日收益: $${s.totalEarnedToday} | 累计: $${s.allTimeEarned}`);
    console.log(`报告已保存: ${filepath}`);
  }
}

module.exports = { generate };
