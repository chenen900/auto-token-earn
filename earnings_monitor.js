// Earnings Monitor — MediaCraft AI 统一收益采集器
// 轮询所有收入渠道 → 标准化 → 写入 data/earnings.json → Render API 暴露
// 新增渠道：在 CHANNELS 数组加一行即可
// 用法: node earnings_monitor.js [--ci]

const fs = require("fs");
const path = require("path");
const https = require("http");
const { execSync } = require("child_process");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const OUTPUT = path.join(DATA_DIR, "earnings.json");

// ========== HTTP 工具 ==========
function fetchJSON(url, opts = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const isHTTPS = u.protocol === "https:";
    const mod = isHTTPS ? require("https") : require("http");
    const req = mod.request(url, { method: opts.method || "GET", headers: opts.headers || {}, timeout: opts.timeout || 10000 }, (res) => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

function now() { return new Date().toISOString(); }
function today() { return now().substring(0, 10); }

// ========== 渠道注册表 — 新增渠道只需加一行 ==========
const CHANNELS = [
  {
    id: "agenthansa", name: "AgentHansa", category: "quest",
    dailyEstimate: "$0.05-0.20",
    check: async () => {
      // 从 Render daemon 状态 + 本地 memory 获取
      let data = { balance: 0, tasks_completed: 0, earned_total: 0, earned_today: 0, reputation: 0 };
      try {
        // 1. Render daemon 实时数据
        const ds = await fetchJSON("https://mediacraft-x402-api.onrender.com/daemon/status");
        if (ds) {
          data.earned_today = ds.earnedToday || 0;
          data.tasks_completed = ds.submissionsToday || 0;
          data.cycles = ds.cycles || 0;
          data.running = ds.running;
        }
        // 2. 本地 memory 历史累计
        const mf = path.join(DATA_DIR, "memory_v3.json");
        if (fs.existsSync(mf)) {
          const m = JSON.parse(fs.readFileSync(mf, "utf-8"));
          data.earned_total = m.earned || 0;
          data.tasks_total = m.submissions || 0;
          data.wins = m.wins || 0;
          data.winRate = data.tasks_total > 0 ? (data.wins / data.tasks_total * 100).toFixed(1) + "%" : "0%";
        }
        // 3. AgentHansa 实时 API
        const ah = await fetchJSON("https://agenthansa.com/api/agents/me", {
          headers: { Authorization: "Bearer " + (process.env.AGENTHANSA_API_KEY || "tabb_RbsUoEipzInRhm2-D2QoH5WHjyYrKJeb9Ff5TUCmx8E") }
        });
        if (ah?.reputation?.overall_score) data.reputation = ah.reputation.overall_score;
        if (ah?.earnings?.total) data.earned_total = Math.max(data.earned_total, parseFloat(ah.earnings.total));
        if (ah?.stats_snapshot) {
          data.rank = ah.stats_snapshot.earnings_rank || "?";
          data.total_agents = ah.stats_snapshot.total_agents || "?";
        }
      } catch(e) {}
      return { ...data, status: data.running ? "active" : "idle" };
    }
  },
  {
    id: "pinchwork", name: "Pinchwork", category: "agent_marketplace",
    dailyEstimate: "$0-20",
    check: async () => {
      let data = { balance: 0, tasks_completed: 0, earned_total: 0, reputation: 0 };
      try {
        const cf = path.join(DATA_DIR, "pinchwork_credentials.json");
        if (!fs.existsSync(cf)) return { ...data, status: "unregistered" };
        const creds = JSON.parse(fs.readFileSync(cf, "utf-8"));
        const me = await fetchJSON("https://pinchwork.dev/v1/me", {
          headers: { Authorization: "Bearer " + creds.api_key }
        });
        if (me) {
          data.balance = me.credits || 0;
          data.tasks_completed = me.tasks_completed || 0;
          data.reputation = me.reputation || 0;
          data.tasks_posted = me.tasks_posted || 0;
        }
        const stats = await fetchJSON("https://pinchwork.dev/v1/me/stats", {
          headers: { Authorization: "Bearer " + creds.api_key }
        });
        if (stats) {
          data.earned_total = stats.total_earned || 0;
          data.earned_7d = stats.recent_7d_earned || 0;
          data.earned_30d = stats.recent_30d_earned || 0;
          data.approval_rate = stats.approval_rate ? (stats.approval_rate * 100).toFixed(0) + "%" : "0%";
          data.avg_task_value = stats.avg_task_value || 0;
        }
      } catch(e) {}
      return { ...data, status: data.tasks_completed > 0 ? "active" : "new" };
    }
  },
  {
    id: "clawhunt", name: "ClawHunt", category: "bounty_board",
    dailyEstimate: "$0-50",
    check: async () => {
      let data = { bounties_submitted: 0, earned_total: 0 };
      try {
        const cf = path.join(DATA_DIR, "clawhunt_credentials.json");
        if (!fs.existsSync(cf)) return { ...data, status: "unregistered" };
        const creds = JSON.parse(fs.readFileSync(cf, "utf-8"));
        const me = await fetchJSON("https://clawhunt.sh/api/agents/me", {
          headers: { Authorization: "Bearer " + creds.api_key }
        });
        if (me) {
          data.bounties_submitted = me.bounties_completed || me.submissions || 0;
          data.reputation = me.reputation || me.karma || 0;
        }
      } catch(e) {}
      return { ...data, status: "active" };
    }
  },
  {
    id: "taskmarket", name: "TaskMarket", category: "bounty_board",
    dailyEstimate: "$0-25",
    check: async () => {
      let data = { tasks_submitted: 0, earned_total: 0 };
      try {
        const cf = path.join(DATA_DIR, "taskmarket_credentials.json");
        if (!fs.existsSync(cf)) return { ...data, status: "unregistered" };
        // TaskMarket 余额查询（无标准API，用本地日志推算）
        const lf = path.join(ROOT, "logs", "taskmarket.log");
        if (fs.existsSync(lf)) {
          const log = fs.readFileSync(lf, "utf-8");
          const subs = (log.match(/SUBMIT:/g) || []).length;
          data.tasks_submitted = subs;
        }
      } catch(e) {}
      return { ...data, status: data.tasks_submitted > 0 ? "active" : "new" };
    }
  },
  {
    id: "dealwork", name: "dealwork.ai", category: "freelance",
    dailyEstimate: "$0-5",
    check: async () => {
      let data = { balance: 0, bids: 0, contracts: 0 };
      try {
        const res = await fetchJSON("https://dealwork.ai/api/v1/wallet/balance", {
          headers: { Authorization: "Bearer " + (process.env.DEALWORK_API_KEY || "ak_d351c9ceecb3d9886a7e19a565bc47cdf482ada8c183500b") }
        });
        if (res?.data?.available) data.balance = parseFloat(res.data.available);
        // 本地日志推算
        const lf = path.join(ROOT, "logs", "dealwork.log");
        if (fs.existsSync(lf)) {
          const log = fs.readFileSync(lf, "utf-8");
          data.bids = (log.match(/bids placed/g) || []).length;
        }
      } catch(e) {}
      return { ...data, status: data.contracts > 0 ? "active" : "idle" };
    }
  },
  {
    id: "devto", name: "Dev.to", category: "content",
    dailyEstimate: "品牌",
    check: async () => {
      let data = { articles: 0 };
      try {
        const af = path.join(ROOT, "devto_articles.json");
        if (fs.existsSync(af)) data.articles = JSON.parse(fs.readFileSync(af, "utf-8")).length;
      } catch(e) {}
      return { ...data, status: data.articles > 0 ? "active" : "new" };
    }
  },
  {
    id: "x402", name: "x402 API", category: "api",
    dailyEstimate: "$0-50",
    check: async () => {
      let data = { calls: 0, earnings: 0 };
      try {
        const ds = await fetchJSON("https://mediacraft-x402-api.onrender.com/dashboard");
        if (ds?.summary) {
          data.calls = ds.summary["总调用"] || 0;
          data.earnings = parseFloat(ds.summary["预估收益"]?.replace("$","")) || 0;
        }
      } catch(e) {}
      return { ...data, status: data.calls > 0 ? "active" : "idle" };
    }
  },
  {
    id: "superteam", name: "Superteam Earn", category: "bounty",
    dailyEstimate: "$0-10",
    check: async () => {
      return { status: "pending", note: "API key needed" };
    }
  },
  {
    id: "toku", name: "Toku Agency", category: "service_market",
    dailyEstimate: "$0-5",
    check: async () => {
      return { status: "pending", note: "API key needed" };
    }
  },
  {
    id: "hashnode", name: "Hashnode", category: "content",
    dailyEstimate: "$0-2",
    check: async () => {
      return { status: "pending", note: "API key needed" };
    }
  },
];

// ========== 主采集逻辑 ==========
async function collect() {
  const ts = now();
  console.log("=== Earnings Monitor ===");
  console.log("Time:", ts);

  // 加载历史数据（用于对比）
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(OUTPUT, "utf-8")); } catch(e) {}

  const results = [];
  let totalEarned = 0;
  let activeChannels = 0;

  for (const ch of CHANNELS) {
    console.log(`Checking: ${ch.name}...`);
    let metrics;
    try {
      metrics = await ch.check();
    } catch(e) {
      metrics = { status: "error", error: e.message };
    }

    const earned = metrics.earned_total || metrics.earnings || metrics.balance || 0;
    totalEarned += earned;
    if (metrics.status === "active" || metrics.status === "idle") activeChannels++;

    // 计算变化
    const prevCh = prev.channels?.find(c => c.id === ch.id);
    const earnedDelta = prevCh ? earned - (prevCh.earned_total || prevCh.earnings || prevCh.balance || 0) : 0;

    results.push({
      id: ch.id,
      name: ch.name,
      category: ch.category,
      dailyEstimate: ch.dailyEstimate,
      status: metrics.status,
      metrics,
      earned_total: earned,
      earned_delta: Math.round(earnedDelta * 100) / 100,
      lastCheck: ts,
      error: metrics.error || null,
    });

    console.log(`  ${ch.name}: ${metrics.status} | earned=$`, earned);
  }

  const report = {
    generatedAt: ts,
    date: today(),
    summary: {
      totalChannels: CHANNELS.length,
      activeChannels,
      totalEarned: Math.round(totalEarned * 100) / 100,
      totalEarnedDisplay: "$" + (Math.round(totalEarned * 100) / 100).toFixed(2),
    },
    channels: results,
    // 对比上次
    previousCheck: prev.generatedAt || null,
    earningsDelta: prev.summary ? Math.round((totalEarned - prev.summary.totalEarned) * 100) / 100 : 0,
  };

  // 写入文件
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${OUTPUT}`);
  console.log(`Total: ${report.summary.totalEarnedDisplay} | Active: ${activeChannels}/${CHANNELS.length}`);
  if (report.earningsDelta !== 0) {
    console.log(`Delta since last check: ${report.earningsDelta >= 0 ? "+" : ""}$${report.earningsDelta}`);
  }

  return report;
}

// ========== CLI / CI ==========
if (require.main === module) {
  const ci = process.argv.includes("--ci");
  collect().then(report => {
    if (ci) {
      // CI 模式：输出简洁摘要
      console.log("\n[EARNINGS-SUMMARY]");
      console.log(`total=${report.summary.totalEarnedDisplay} active=${report.summary.activeChannels}/${report.summary.totalChannels}`);
      for (const ch of report.channels) {
        console.log(`${ch.id}=${ch.status} earned=$`, ch.earned_total);
      }
    }
    process.exit(0);
  }).catch(e => {
    console.error("FATAL:", e.message);
    process.exit(1);
  });
}

module.exports = { collect, CHANNELS };
