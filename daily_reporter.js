// Daily Financial Reporter — MediaCraft AI
// 每日收益/成本/ROI 自动报告
// 触发自 show-me-the-money 的 money-finance Skill
const fs = require("fs");
const path = require("path");
const https = require("https");

const DATA_DIR = path.join(__dirname, "data");
const REPORT_DIR = path.join(DATA_DIR, "reports");

function api(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => { let d=""; res.on("data",c=>d+=c); res.on("end",()=>{ try{resolve(JSON.parse(d));}catch(e){resolve(null);} }); }).on("error",()=>resolve(null));
  });
}

async function generateReport() {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const today = new Date().toISOString().substring(0, 10);
  const reportPath = path.join(REPORT_DIR, `report_${today}.json`);

  // 收集数据
  const daemon = await api("https://mediacraft-x402-api.onrender.com/daemon/status");
  const ah = await api("https://agenthansa.com/api/agents/me");

  // DeFi 模拟
  let defiData = null;
  try { defiData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "defi_simulation.json"), "utf-8")); } catch(e) {}

  // 学习引擎
  let learningData = null;
  try { learningData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "memory_v3.json"), "utf-8")); } catch(e) {}

  const report = {
    date: today,
    generatedAt: new Date().toISOString(),
    earnings: {
      agentHansa: ah?.earnings?.total || "$0.26",
      daemonCycles: daemon?.cycles || 0,
      daemonSubmissions: daemon?.submissionsToday || 0,
      totalSubmissions: learningData?.submissions || 0,
      totalWins: learningData?.wins || 0,
      totalEarned: learningData?.earned || 0,
      winRate: learningData?.submissions > 0
        ? ((learningData.wins / learningData.submissions) * 100).toFixed(1) + "%"
        : "N/A",
    },
    daemon: {
      cycles: daemon?.cycles || 0,
      uptimeMinutes: Math.floor((daemon?.uptime || 0) / 60),
      running: daemon?.running || false,
      errors: daemon?.errors || 0,
    },
    defi: defiData ? Object.entries(defiData.accounts||{}).map(([k,v])=>({
      account: k,
      capital: Math.round(v.capital*100)/100,
      earned: Math.round(v.totalEarned*100)/100,
      roi: ((v.capital - v.initialCapital)/v.initialCapital*100).toFixed(2)+"%"
    })) : [],
    byCategory: learningData?.categories || {},
    verdict: "IN_PROGRESS",
    recommendations: [],
  };

  // 建议
  if (report.earnings.winRate === "N/A" || parseFloat(report.earnings.winRate) < 10) {
    report.recommendations.push("胜率低于10%，建议：1) 专注技术类Quest 2) 验证Proof URL 3) 提高内容长度");
  }
  if (report.daemon.cycles < 10) {
    report.recommendations.push("Daemon循环过少，检查Render部署和keepalive");
  }
  if (report.daemon.errors > 5) {
    report.recommendations.push("Daemon错误过多，检查API速率限制和网络连接");
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // 简短日报
  const summary = [
    `MediaCraft AI 日报 — ${today}`,
    ``,
    `收益: $${report.earnings.totalEarned} | ${report.earnings.winRate} 胜率`,
    `Daemon: ${report.daemon.cycles} 循环 | ${report.daemon.uptimeMinutes}分钟`,
    `建议: ${report.recommendations[0] || "继续运行"}`,
  ].join("\n");

  fs.writeFileSync(path.join(REPORT_DIR, `summary_${today}.txt`), summary);
  console.log(summary);

  return report;
}

if (require.main === module) {
  generateReport().then(r => console.log("\nReport saved: reports/report_" + new Date().toISOString().substring(0,10) + ".json"));
}

module.exports = { generateReport };
