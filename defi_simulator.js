// DeFi Paper Trading Simulator — MediaCraft AI
// 模拟多账户 USDC 收益农耕，每日自动运行积累经验
// 用法: node defi_simulator.js [--run] [--report]

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const SIM_FILE = path.join(DATA_DIR, "defi_simulation.json");

// ========== 模拟策略 ==========
const STRATEGIES = {
  ultra_safe: {
    name: "极保守", allocation: { coinbase: 1.0 },
    description: "100% Coinbase Rewards，无风险零操作",
  },
  conservative: {
    name: "保守", allocation: { coinbase: 0.5, aave_base: 0.5 },
    description: "50% Coinbase + 50% Aave Base",
  },
  balanced: {
    name: "均衡", allocation: { aave_base: 0.4, morpho: 0.3, beefy: 0.3 },
    description: "40% Aave + 30% Morpho + 30% Beefy",
  },
  growth: {
    name: "成长", allocation: { morpho: 0.3, beefy: 0.3, aerodrome: 0.25, curve: 0.15 },
    description: "Morpho + Beefy + Aerodrome + Curve 组合",
  },
  aggressive: {
    name: "激进", allocation: { aerodrome: 0.4, pendle: 0.4, morpho: 0.2 },
    description: "40% Aerodrome + 40% Pendle + 20% Morpho",
  },
};

// ========== 当前收益率（模拟用，会随时间波动） ==========
const CURRENT_APY = {
  coinbase:  { apy: 3.8,  risk: 0.01, volatility: 0.002 },
  aave_base: { apy: 5.2,  risk: 0.02, volatility: 0.005 },
  morpho:    { apy: 6.8,  risk: 0.03, volatility: 0.008 },
  beefy:     { apy: 7.5,  risk: 0.04, volatility: 0.010 },
  curve:     { apy: 4.5,  risk: 0.03, volatility: 0.006 },
  aerodrome: { apy: 11.0, risk: 0.08, volatility: 0.025 },
  pendle:    { apy: 13.5, risk: 0.10, volatility: 0.030 },
};

// ========== 模拟引擎 ==========

class DefiSimulator {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(SIM_FILE)) return JSON.parse(fs.readFileSync(SIM_FILE, "utf-8"));
    } catch (e) {}
    return this._fresh();
  }

  _fresh() {
    return {
      started: new Date().toISOString(),
      accounts: {},
      dailyLog: [],
      lastRun: null,
    };
  }

  _save() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SIM_FILE, JSON.stringify(this.data, null, 2));
  }

  // 创建模拟账户
  createAccount(name, capital, strategy) {
    if (this.data.accounts[name]) return { error: "账户已存在" };
    this.data.accounts[name] = {
      name,
      initialCapital: capital,
      capital: capital,
      strategy,
      allocation: STRATEGIES[strategy]?.allocation || {},
      totalEarned: 0,
      history: [],
      createdAt: new Date().toISOString(),
    };
    this._save();
    return this.data.accounts[name];
  }

  // 每日运行模拟
  runDaily() {
    const today = new Date().toISOString().substring(0, 10);
    if (this.data.lastRun === today) {
      return { skipped: true, message: `今天已运行 (${today})` };
    }

    const dayLog = { date: today, accounts: {}, totalEarned: 0 };

    for (const [name, account] of Object.entries(this.data.accounts)) {
      let dailyEarned = 0;
      const breakdown = {};

      for (const [protocol, weight] of Object.entries(account.allocation)) {
        const protocolData = CURRENT_APY[protocol];
        if (!protocolData) continue;

        // 模拟 APY 波动（随机小幅变化）
        const noise = (Math.random() - 0.5) * 2 * protocolData.volatility;
        const effectiveApy = Math.max(0, protocolData.apy + noise * protocolData.apy);

        const allocatedCapital = account.capital * weight;
        const dailyYield = (allocatedCapital * effectiveApy / 100) / 365;

        breakdown[protocol] = {
          allocated: Math.round(allocatedCapital * 100) / 100,
          apy: Math.round(effectiveApy * 100) / 100,
          earned: Math.round(dailyYield * 10000) / 10000,
        };

        dailyEarned += dailyYield;
      }

      // 复利：收益再加入本金
      account.capital += dailyEarned;
      account.totalEarned += dailyEarned;
      account.history.push({
        date: today,
        earned: Math.round(dailyEarned * 10000) / 10000,
        capital: Math.round(account.capital * 100) / 100,
      });

      // 只保留最近 365 天
      if (account.history.length > 365) account.history = account.history.slice(-365);

      dayLog.accounts[name] = {
        strategy: account.strategy,
        capital: Math.round(account.capital * 100) / 100,
        earned: Math.round(dailyEarned * 10000) / 10000,
        totalEarned: Math.round(account.totalEarned * 100) / 100,
        breakdown,
      };
      dayLog.totalEarned += dailyEarned;
    }

    dayLog.totalEarned = Math.round(dayLog.totalEarned * 10000) / 10000;
    this.data.dailyLog.push(dayLog);
    if (this.data.dailyLog.length > 365) this.data.dailyLog = this.data.dailyLog.slice(-365);
    this.data.lastRun = today;
    this._save();

    return dayLog;
  }

  // 生成报表
  generateReport() {
    const accounts = Object.values(this.data.accounts);
    if (accounts.length === 0) return { error: "没有模拟账户，先创建" };

    const report = {
      generatedAt: new Date().toISOString(),
      daysRunning: Math.floor((Date.now() - new Date(this.data.started).getTime()) / 86400000),
      accounts: accounts.map((a) => ({
        name: a.name,
        strategy: STRATEGIES[a.strategy]?.name || a.strategy,
        initialCapital: a.initialCapital,
        currentCapital: Math.round(a.capital * 100) / 100,
        totalEarned: Math.round(a.totalEarned * 100) / 100,
        roi: Math.round(((a.capital - a.initialCapital) / a.initialCapital) * 10000) / 100 + "%",
        dailyAvg: a.history.length > 0
          ? Math.round((a.totalEarned / a.history.length) * 10000) / 10000
          : 0,
        projectedYearly: a.history.length > 0
          ? Math.round((a.totalEarned / a.history.length * 365) * 100) / 100
          : 0,
        effectiveAPY: a.history.length > 0 && a.initialCapital > 0
          ? Math.round((a.totalEarned / a.history.length * 365 / a.initialCapital) * 1000) / 10 + "%"
          : "N/A",
      })),
      ranking: [],
    };

    // 按收益排名
    report.ranking = [...report.accounts].sort((a, b) => b.totalEarned - a.totalEarned);
    return report;
  }

  // 项目到未来
  projectFuture(days = 365) {
    const projections = {};
    for (const [name, account] of Object.entries(this.data.accounts)) {
      let cap = account.capital;
      const dailyAvg = account.history.length > 0
        ? account.totalEarned / account.history.length
        : account.capital * 0.06 / 365;

      const milestones = {};
      for (const daysTarget of [7, 30, 90, 180, 365]) {
        if (daysTarget <= days) {
          cap = account.capital * Math.pow(1 + dailyAvg / account.capital, daysTarget);
          milestones[daysTarget + "d"] = Math.round(cap * 100) / 100;
        }
      }

      projections[name] = {
        strategy: account.strategy,
        current: Math.round(account.capital * 100) / 100,
        projections: milestones,
      };
    }
    return projections;
  }
}

// ========== CLI ==========
if (require.main === module) {
  const sim = new DefiSimulator();
  const cmd = process.argv[2] || "status";

  if (cmd === "init") {
    // 创建默认模拟账户
    const defaults = [
      { name: "safe_test", capital: 500, strategy: "conservative" },
      { name: "balanced_test", capital: 500, strategy: "balanced" },
      { name: "growth_test", capital: 500, strategy: "growth" },
      { name: "aggressive_test", capital: 100, strategy: "aggressive" },
    ];
    for (const d of defaults) {
      const result = sim.createAccount(d.name, d.capital, d.strategy);
      console.log(`Created: ${d.name} ($${d.capital}) — ${d.strategy}`);
    }
  } else if (cmd === "run" || cmd === "--run") {
    const result = sim.runDaily();
    if (result.skipped) {
      console.log(result.message);
    } else {
      console.log(`\n📊 DeFi 模拟日报 — ${result.date}`);
      console.log("-".repeat(60));
      for (const [name, data] of Object.entries(result.accounts)) {
        console.log(`${name} (${data.strategy}): +$${data.earned} → $${data.capital} [累计 $${data.totalEarned}]`);
      }
      console.log(`\n💰 今日总收益: $${result.totalEarned}`);
    }
  } else if (cmd === "report" || cmd === "--report") {
    const report = sim.generateReport();
    if (report.error) { console.log(report.error); process.exit(0); }
    console.log(`\n📈 DeFi 模拟报表 (${report.daysRunning} 天)\n`);
    console.log("账户          策略    初始    当前    收益    ROI     年化");
    console.log("-".repeat(70));
    for (const a of report.ranking) {
      console.log(
        `${a.name.padEnd(14)} ${a.strategy.padEnd(8)} $${String(a.initialCapital).padEnd(7)} $${String(a.currentCapital).padEnd(7)} $${String(a.totalEarned).padEnd(7)} ${String(a.roi).padEnd(7)} ${a.effectiveAPY}`
      );
    }
  } else if (cmd === "project" || cmd === "--project") {
    const proj = sim.projectFuture();
    console.log("\n🔮 未来收益预测:\n");
    for (const [name, p] of Object.entries(proj)) {
      console.log(`${name} (${p.strategy}):`);
      for (const [d, val] of Object.entries(p.projections)) {
        console.log(`  ${d}: $${val}`);
      }
    }
  } else {
    const report = sim.generateReport();
    const totalCapital = (report.accounts || []).reduce((s, a) => s + a.currentCapital, 0);
    const totalEarned = (report.accounts || []).reduce((s, a) => s + a.totalEarned, 0);
    console.log(`\n🏦 DeFi 模拟器状态`);
    console.log(`账户数: ${report.accounts?.length || 0} | 总本金: $${Math.round(totalCapital * 100) / 100} | 总收益: $${Math.round(totalEarned * 100) / 100}`);
    console.log(`运行: node defi_simulator.js init    — 初始化模拟账户`);
    console.log(`      node defi_simulator.js run     — 运行每日模拟`);
    console.log(`      node defi_simulator.js report  — 查看报表`);
    console.log(`      node defi_simulator.js project — 未来预测`);
  }
}

module.exports = { DefiSimulator, STRATEGIES, CURRENT_APY };
