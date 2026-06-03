// Bid Tracker — 每笔投标全链路追踪 + 分析引擎
// 输出: data/bid_history.jsonl (append-only), data/bid_analytics.json (覆盖写入)
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const HISTORY_FILE = path.join(DATA_DIR, "bid_history.jsonl");
const ANALYTICS_FILE = path.join(DATA_DIR, "bid_analytics.json");
const LEDGER_FILE = path.join(DATA_DIR, "token_ledger.jsonl");

// ====== 投标记录 ======
function logBid({ questId, questTitle, questDescription, category, reward, responseType, responseSummary, proofUrl }) {
  const record = {
    type: "bid",
    questId: questId || "unknown",
    questTitle: (questTitle || "").substring(0, 120),
    questDescription: (questDescription || "").substring(0, 300),
    category: category || "unknown",
    reward: parseFloat(reward) || 0,
    responseType: responseType || "template",  // "ai_generated" | "template" | "hybrid"
    responseSummary: (responseSummary || "").substring(0, 200),
    proofUrl: proofUrl || "",
    time: new Date().toISOString(),
    status: "submitted"  // submitted → won | lost | rejected | timeout
  };
  fs.appendFileSync(HISTORY_FILE, JSON.stringify(record) + "\n");
  return record;
}

// ====== 结果回填 ======
function logResult(questId, result, actualReward) {
  // result: "won" | "lost" | "rejected" | "timeout"
  const record = {
    type: "result",
    questId: questId,
    result: result,
    actualReward: parseFloat(actualReward) || 0,
    time: new Date().toISOString()
  };
  fs.appendFileSync(HISTORY_FILE, JSON.stringify(record) + "\n");

  // 如果赢了，记录到账本
  if (result === "won" && actualReward > 0) {
    logEarning(questId, actualReward);
  }
  return record;
}

// ====== 收益记录 ======
function logEarning(source, amount) {
  const record = {
    type: "earning",
    source: source || "unknown",
    amount: parseFloat(amount) || 0,
    time: new Date().toISOString()
  };
  fs.appendFileSync(LEDGER_FILE, JSON.stringify(record) + "\n");
  return record;
}

// ====== 质量评估记录（投标前自评） ======
function logQualityCheck({ questId, score, passed, reasons }) {
  const record = {
    type: "quality_check",
    questId: questId,
    score: score || 0,       // 0-100
    passed: !!passed,
    reasons: reasons || [],
    time: new Date().toISOString()
  };
  fs.appendFileSync(HISTORY_FILE, JSON.stringify(record) + "\n");
  return record;
}

// ====== 读取历史 ======
function readHistory(limit = 100) {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  const raw = fs.readFileSync(HISTORY_FILE, "utf-8").trim();
  if (!raw) return [];
  const lines = raw.split("\n");
  const start = Math.max(0, lines.length - limit);
  return lines.slice(start).map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(Boolean);
}

function readLedger(limit = 500) {
  if (!fs.existsSync(LEDGER_FILE)) return [];
  const raw = fs.readFileSync(LEDGER_FILE, "utf-8").trim();
  if (!raw) return [];
  const lines = raw.split("\n");
  const start = Math.max(0, lines.length - limit);
  return lines.slice(start).map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(Boolean);
}

// ====== 分析引擎 ======
function analyze(todayOnly = true) {
  const history = readHistory(5000);
  const today = new Date().toISOString().substring(0, 10);

  const bids = history.filter(r => r.type === "bid");
  const results = history.filter(r => r.type === "result");
  const earnings = history.filter(r => r.type === "earning");
  const qualityChecks = history.filter(r => r.type === "quality_check");

  // 按日期过滤
  const filterByDate = (arr) => todayOnly ? arr.filter(r => (r.time || "").startsWith(today)) : arr;

  const todayBids = filterByDate(bids);
  const todayResults = filterByDate(results);
  const todayEarnings = filterByDate(earnings);

  // 按 questId 匹配结果
  const resultMap = {};
  for (const r of results) {
    resultMap[r.questId] = r;
  }

  // 逐笔分析
  const bidDetails = todayBids.map(b => {
    const res = resultMap[b.questId];
    return {
      questId: b.questId,
      title: b.questTitle,
      category: b.category,
      reward: b.reward,
      responseType: b.responseType,
      result: res ? res.result : "pending",
      actualReward: res ? res.actualReward : 0
    };
  });

  // 分类统计
  const byCategory = {};
  for (const b of bidDetails) {
    if (!byCategory[b.category]) {
      byCategory[b.category] = { bids: 0, won: 0, lost: 0, pending: 0, potentialReward: 0, actualReward: 0 };
    }
    byCategory[b.category].bids++;
    byCategory[b.category].potentialReward += b.reward;
    if (b.result === "won") { byCategory[b.category].won++; byCategory[b.category].actualReward += b.actualReward; }
    else if (b.result === "lost") byCategory[b.category].lost++;
    else byCategory[b.category].pending++;
  }

  // 按响应类型统计
  const byResponseType = {};
  for (const b of bidDetails) {
    if (!byResponseType[b.responseType]) {
      byResponseType[b.responseType] = { bids: 0, won: 0, lost: 0 };
    }
    byResponseType[b.responseType].bids++;
    if (b.result === "won") byResponseType[b.responseType].won++;
    else if (b.result === "lost") byResponseType[b.responseType].lost++;
  }

  // 质量门禁统计
  const qualityStats = {
    total: qualityChecks.length,
    passed: qualityChecks.filter(q => q.passed).length,
    failed: qualityChecks.filter(q => !q.passed).length,
    avgScore: qualityChecks.length > 0
      ? Math.round(qualityChecks.reduce((s, q) => s + q.score, 0) / qualityChecks.length)
      : 0
  };

  // 累计收益
  const totalEarned = todayEarnings.reduce((s, e) => s + e.amount, 0);
  const allTimeEarned = earnings.reduce((s, e) => s + e.amount, 0);

  const analytics = {
    generatedAt: new Date().toISOString(),
    date: today,
    period: todayOnly ? "today" : "all_time",
    summary: {
      totalBids: todayBids.length,
      resolvedResults: todayResults.length,
      won: bidDetails.filter(b => b.result === "won").length,
      lost: bidDetails.filter(b => b.result === "lost").length,
      pending: bidDetails.filter(b => b.result === "pending").length,
      winRate: bidDetails.filter(b => b.result !== "pending").length > 0
        ? Math.round(bidDetails.filter(b => b.result === "won").length / bidDetails.filter(b => b.result !== "pending").length * 100)
        : 0,
      totalEarnedToday: Math.round(totalEarned * 100) / 100,
      allTimeEarned: Math.round(allTimeEarned * 100) / 100,
      avgRewardPerBid: todayBids.length > 0
        ? Math.round(todayBids.reduce((s, b) => s + b.reward, 0) / todayBids.length * 100) / 100
        : 0
    },
    byCategory,
    byResponseType,
    qualityGating: qualityStats,
    recentBids: bidDetails.slice(-10)
  };

  // 覆盖写入分析文件
  try { fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2)); } catch(e) {}

  return analytics;
}

// ====== 获取待跟进的结果（已提交超过2h还没结果的） ======
function getPendingResults(hoursThreshold = 2) {
  const history = readHistory(5000);
  const bids = history.filter(r => r.type === "bid");
  const results = history.filter(r => r.type === "result");
  const resultIds = new Set(results.map(r => r.questId));

  const threshold = Date.now() - hoursThreshold * 3600 * 1000;
  return bids.filter(b => {
    return !resultIds.has(b.questId) && new Date(b.time).getTime() < threshold;
  });
}

module.exports = {
  logBid, logResult, logEarning, logQualityCheck,
  readHistory, readLedger, analyze, getPendingResults
};
