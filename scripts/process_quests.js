#!/usr/bin/env node
// Quest Processor — 处理 inbox 中的待响应任务（由 Claude 辅助生成回复）
// 用法:
//   node scripts/process_quests.js list            — 列出所有待处理 quest
//   node scripts/process_quests.js show <id>       — 显示 quest 详情
//   node scripts/process_quests.js stats           — 管线统计

const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const questPipeline = require(path.join(ROOT, "lib", "quest_pipeline.js"));
const bidTracker = require(path.join(ROOT, "lib", "bid_tracker.js"));

function cmdList() {
  const pending = questPipeline.getPendingQuests();
  if (pending.length === 0) {
    console.log("✅ 收件箱为空，无待处理任务。");
    return;
  }

  console.log(`📥 待处理任务: ${pending.length} 个\n`);
  console.log("ID | 赏金 | 类别 | 标题");
  console.log("---|------|------|------");
  for (const q of pending) {
    const id = (q.id || "").substring(0, 20);
    const reward = "$" + (q.reward_usd || 0);
    const cat = (q.category || "?").substring(0, 10);
    const title = (q.title || "").substring(0, 50);
    console.log(`${id} | ${reward} | ${cat} | ${title}`);
  }

  console.log(`\n💡 运行 "node scripts/process_quests.js show <id>" 查看详情`);
  console.log(`💡 总赏金池: $${pending.reduce((s, q) => s + (q.reward_usd || 0), 0).toFixed(2)}`);
}

function cmdShow(questId) {
  const q = questPipeline.getQuest(questId);
  if (!q) {
    console.log(`❌ 未找到任务: ${questId}`);
    console.log("可用 ID:");
    const pending = questPipeline.getPendingQuests();
    pending.forEach(p => console.log(`  ${p.id} — ${(p.title || "").substring(0, 60)}`));
    return;
  }

  console.log("========================================");
  console.log(`📋 任务 ID: ${q.id}`);
  console.log(`📌 标题: ${q.title}`);
  console.log(`💰 赏金: $${q.reward_usd}`);
  console.log(`🏷️ 类别: ${q.category || "未分类"}`);
  console.log(`📅 创建时间: ${q.created_at || "未知"}`);
  console.log(`📥 收入时间: ${q.saved_at}`);
  console.log(`📊 状态: ${q.status}`);
  console.log("========================================");
  console.log("\n📝 描述:");
  console.log(q.description || "(无描述)");
  console.log("\n📎 原始数据摘要:");
  console.log(JSON.stringify(q.raw, null, 2).substring(0, 500));
  console.log("\n========================================");
  console.log("💡 将此任务详情发给 Claude，让 Claude 生成针对性回复");
  console.log("💡 回复写入: node -e \"require('./lib/quest_pipeline.js').saveResponse('" + q.id + "', '你的回复内容')\"");
}

function cmdStats() {
  const s = questPipeline.stats();
  const analytics = bidTracker.analyze(true);

  console.log("=== 任务管线统计 ===");
  console.log(`📥 收件箱待处理: ${s.inbox_pending}`);
  console.log(`✅ 已回复待提交: ${s.outbox_ready}`);
  console.log(`📤 已提交等结果: ${s.outbox_submitted}`);
  console.log(`📦 已归档: ${s.archived}`);
  console.log(`📊 累计处理: ${s.total_processed}`);
  console.log("");
  console.log("=== 今日投标统计 ===");
  console.log(`投标: ${analytics.summary.totalBids} | 胜: ${analytics.summary.won} | 负: ${analytics.summary.lost} | 胜率: ${analytics.summary.winRate}%`);
  console.log(`今日收益: $${analytics.summary.totalEarnedToday} | 累计: $${analytics.summary.allTimeEarned}`);
}

function cmdExportForClaude() {
  // 导出所有待处理 quest 为 Claude 可读的格式
  const pending = questPipeline.getPendingQuests();
  if (pending.length === 0) {
    console.log("NO_PENDING_QUESTS");
    return;
  }

  const exportData = {
    exportTime: new Date().toISOString(),
    totalQuests: pending.length,
    totalRewardPool: pending.reduce((s, q) => s + (q.reward_usd || 0), 0),
    quests: pending.map(q => ({
      id: q.id,
      title: q.title,
      description: q.description,
      reward: q.reward_usd,
      category: q.category,
      created: q.created_at
    }))
  };

  const outFile = path.join(ROOT, "data", "quests_export.json");
  fs.writeFileSync(outFile, JSON.stringify(exportData, null, 2));
  console.log(`✅ 已导出 ${pending.length} 个任务到 data/quests_export.json`);
  console.log(`📋 总赏金池: $${exportData.totalRewardPool.toFixed(2)}`);
}

// ====== CLI ======
if (require.main === module) {
  const cmd = process.argv[2] || "list";
  const arg = process.argv[3];

  switch (cmd) {
    case "list": cmdList(); break;
    case "show": cmdShow(arg); break;
    case "stats": cmdStats(); break;
    case "export": cmdExportForClaude(); break;
    default:
      console.log("用法: node scripts/process_quests.js [list|show <id>|stats|export]");
  }
}

module.exports = { cmdList, cmdShow, cmdStats, cmdExportForClaude };
