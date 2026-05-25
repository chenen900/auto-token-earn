// 统一收益仪表板 — 汇聚所有收入线
// 用法: node unified_dashboard.js

const https = require("https");
const path = require("path");
const fs = require("fs");

const AGENTHANSA_KEY = process.env.AGENTHANSA_API_KEY || "tabb_RbsUoEipzInRhm2-D2QoH5WHjyYrKJeb9Ff5TUCmx8E";
const DEALWORK_KEY = process.env.DEALWORK_API_KEY || "ak_d351c9ceecb3d9886a7e19a565bc47cdf482ada8c183500b";
const DEVTO_KEY = process.env.DEVTO_API_KEY || "j6yoCyDvjfHorQnwi2EQH5cn";

function fetch(url, headers) {
  return new Promise(function (resolve, reject) {
    https.get(url, { headers: headers }, function (res) {
      var d = "";
      res.on("data", function (c) { d += c; });
      res.on("end", function () {
        try { resolve(JSON.parse(d)); } catch (e) { resolve({ raw: d.substring(0, 200) }); }
      });
    }).on("error", reject);
  });
}

async function fetchAll() {
  var result = {
    timestamp: new Date().toISOString(),
    lines: {},
    total: { estimatedDaily: 0, pending: 0 },
    wallets: {},
  };

  // 1. AgentHansa
  try {
    var ah = await fetch("https://agenthansa.com/api/agents/me", { Authorization: "Bearer " + AGENTHANSA_KEY });
    result.lines.agentHansa = {
      balance: ah.earnings ? ah.earnings.total : "$0.00",
      streak: ah.stats_snapshot ? ah.stats_snapshot.streak + " days" : "?",
      reputation: ah.reputation ? ah.reputation.overall_score : "?",
      rank: ah.stats_snapshot ? ah.stats_snapshot.earnings_rank + "/" + ah.stats_snapshot.total_agents : "?",
      questSubmissions: ah.stats_snapshot ? ah.stats_snapshot.quest_submissions : 0,
    };
  } catch (e) { result.lines.agentHansa = { error: e.message }; }

  // 2. dealwork.ai
  try {
    var dw = await fetch("https://dealwork.ai/api/v1/wallet/balance", { Authorization: "Bearer " + DEALWORK_KEY });
    var dwContracts = await fetch("https://dealwork.ai/api/v1/contracts?role=worker", { Authorization: "Bearer " + DEALWORK_KEY });
    result.lines.dealwork = {
      balance: dw.data ? dw.data.available + " " + dw.data.currency : "$0",
      activeContracts: (dwContracts.data || []).length,
    };
  } catch (e) { result.lines.dealwork = { error: e.message }; }

  // 3. x402 API
  try {
    var x402Stats = await fetch("https://mediacraft-x402-api.onrender.com/dashboard", {});
    result.lines.x402Api = {
      totalCalls: x402Stats.summary ? x402Stats.summary["总调用"] : 0,
      estimated: x402Stats.summary ? x402Stats.summary["预估收益"] : "$0",
      endpoints: x402Stats.calls || {},
    };
  } catch (e) { result.lines.x402Api = { error: e.message }; }

  // 4. Dev.to
  try {
    var dv = await fetch("https://dev.to/api/articles/me/published?per_page=5", { "api-key": DEVTO_KEY });
    var totalViews = 0;
    var totalReactions = 0;
    if (Array.isArray(dv)) {
      dv.forEach(function (a) {
        totalViews += a.page_views_count || 0;
        totalReactions += a.positive_reactions_count || 0;
      });
    }
    result.lines.devto = {
      publishedArticles: Array.isArray(dv) ? dv.length : "?",
      totalViews: totalViews,
      totalReactions: totalReactions,
    };
  } catch (e) { result.lines.devto = { error: e.message }; }

  // 5. 钱包
  result.wallets = {
    solana: "8ZqmcWARgGjZzJLzqwquG8GTvDb39RFbTWKqhShqbtht",
    base: "0x4445212f0C20EBAfCe3923fB16178cB04a8329ad",
    checkSolana: "https://solscan.io/account/8ZqmcWARgGjZzJLzqwquG8GTvDb39RFbTWKqhShqbtht",
    checkBase: "https://basescan.org/address/0x4445212f0C20EBAfCe3923fB16178cB04a8329ad",
  };

  return result;
}

fetchAll().then(function (r) {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   MediaCraft AI — 统一收益仪表板       ║");
  console.log("╠══════════════════════════════════════════╣");

  // AgentHansa
  var ah = r.lines.agentHansa;
  console.log("║ 1. AgentHansa                           ║");
  console.log("║    余额: " + pad(ah.balance || "$0", 26) + "║");
  console.log("║    签到: " + pad(ah.streak || "?", 26) + "║");
  console.log("║    声誉: " + pad(String(ah.reputation || "?"), 26) + "║");
  console.log("║    排名: " + pad(ah.rank || "?", 26) + "║");
  console.log("╠══════════════════════════════════════════╣");

  // dealwork
  var dw = r.lines.dealwork;
  console.log("║ 2. dealwork.ai                          ║");
  console.log("║    余额: " + pad(dw.balance || "$0", 26) + "║");
  console.log("║    合约: " + pad(String(dw.activeContracts || 0), 26) + "║");
  console.log("╠══════════════════════════════════════════╣");

  // x402
  var x4 = r.lines.x402Api;
  console.log("║ 3. x402 付费 API                        ║");
  console.log("║    调用: " + pad(String(x4.totalCalls || 0), 26) + "║");
  console.log("║    预估: " + pad(x4.estimated || "$0", 26) + "║");
  console.log("╠══════════════════════════════════════════╣");

  // Dev.to
  var dv = r.lines.devto;
  console.log("║ 4. Dev.to 内容                          ║");
  console.log("║    文章: " + pad(String(dv.publishedArticles || 0), 26) + "║");
  console.log("║    阅读: " + pad(String(dv.totalViews || 0), 26) + "║");
  console.log("╠══════════════════════════════════════════╣");

  // 钱包
  console.log("║ 钱包                                    ║");
  console.log("║  Solana: ..." + r.wallets.solana.substring(32) + " ║");
  console.log("║  Base:   ..." + r.wallets.base.substring(34) + " ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
});

function pad(s, len) {
  var str = String(s);
  return str + " ".repeat(Math.max(0, len - str.length));
}
