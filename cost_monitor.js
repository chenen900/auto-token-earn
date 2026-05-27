// Cost Monitor — MediaCraft AI
// Token 预算监管 + 收益率追踪
// 核心原则：每天赚的钱必须 > 每天消耗的 Token 费用

const fs = require("fs");
const path = require("path");

// ========== 成本模型 ==========
// Claude Code Token 价格参考（2026 年定价）
const TOKEN_COST = {
  opus: { input: 15.00 / 1_000_000, output: 75.00 / 1_000_000 },   // $15/$75 per 1M tokens
  sonnet: { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },   // $3/$15 per 1M tokens
  haiku: { input: 1.50 / 1_000_000, output: 7.50 / 1_000_000 },     // ~estimate
};

// 预算阈值（USD/天）
const BUDGET = {
  dailyMax: 5.00,        // 每日 Token 预算上限
  warningAt: 3.00,       // 到达此金额时提醒
  dailyEarnTarget: 5.00, // 每日收入目标（覆盖 Token + 净赚）
};

class CostMonitor {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.costPath = path.join(dataDir, "cost_log.json");
    this.records = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.costPath)) return JSON.parse(fs.readFileSync(this.costPath, "utf-8"));
    } catch (e) {}
    return [];
  }

  save() {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(this.costPath, JSON.stringify(this.records, null, 2));
  }

  // ========== 记录一次会话的 Token 消耗 ==========
  recordSession({ inputTokens, outputTokens, model = "sonnet", purpose = "development" }) {
    const inputCost = inputTokens * TOKEN_COST[model].input;
    const outputCost = outputTokens * TOKEN_COST[model].output;
    const totalCost = inputCost + outputCost;

    const entry = {
      time: new Date().toISOString(),
      date: new Date().toISOString().substring(0, 10),
      inputTokens,
      outputTokens,
      model,
      purpose,
      cost: Math.round(totalCost * 10000) / 10000,
    };

    this.records.push(entry);
    // 保留最近 90 天
    const cutoff = Date.now() - 90 * 86400000;
    this.records = this.records.filter((r) => new Date(r.time).getTime() > cutoff);
    this.save();

    return entry;
  }

  // ========== 每日统计 ==========
  dailyReport(date) {
    const d = date || new Date().toISOString().substring(0, 10);
    const today = this.records.filter((r) => r.date === d);

    const totalCost = today.reduce((s, r) => s + r.cost, 0);
    const totalInput = today.reduce((s, r) => s + r.inputTokens, 0);
    const totalOutput = today.reduce((s, r) => s + r.outputTokens, 0);

    return {
      date: d,
      sessions: today.length,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCost: Math.round(totalCost * 10000) / 10000,
      byPurpose: this._groupBy(today, "purpose"),
      status: totalCost > BUDGET.dailyMax ? "OVER_BUDGET"
        : totalCost > BUDGET.warningAt ? "WARNING"
        : "OK",
    };
  }

  // ========== ROI 计算 ==========
  roiReport(date) {
    const d = date || new Date().toISOString().substring(0, 10);
    const daily = this.dailyReport(d);

    // 尝试读取收益数据
    let earned = 0;
    try {
      const trialPath = path.join(this.dataDir, "trial_log.json");
      if (fs.existsSync(trialPath)) {
        const trials = JSON.parse(fs.readFileSync(trialPath, "utf-8"));
        const todayTrials = trials.filter((t) => t.time?.startsWith(d));
        earned = todayTrials.reduce((s, t) => s + (t.reward || 0), 0);
      }
    } catch (e) {}

    return {
      date: d,
      cost: daily.totalCost,
      earned: Math.round(earned * 10000) / 10000,
      net: Math.round((earned - daily.totalCost) * 10000) / 10000,
      roi: daily.totalCost > 0
        ? Math.round((earned / daily.totalCost) * 100) + "%"
        : "N/A",
      verdict: earned > daily.totalCost ? "PROFIT"
        : earned > 0 ? "DEFICIT"
        : "NO_EARNINGS",
    };
  }

  // ========== 月度总结 ==========
  monthlyReport(yearMonth) {
    const ym = yearMonth || new Date().toISOString().substring(0, 7);
    const monthRecords = this.records.filter((r) => r.date.startsWith(ym));

    const totalCost = monthRecords.reduce((s, r) => s + r.cost, 0);
    const dailyAvg = totalCost / Math.max(new Set(monthRecords.map((r) => r.date)).size, 1);

    return {
      month: ym,
      totalCost: Math.round(totalCost * 100) / 100,
      dailyAvg: Math.round(dailyAvg * 100) / 100,
      totalTokens: monthRecords.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
      sessionCount: monthRecords.length,
    };
  }

  // ========== 预算警报 ==========
  checkBudget() {
    const daily = this.dailyReport();

    if (daily.status === "OVER_BUDGET") {
      return {
        alert: "critical",
        message: `今日 Token 费用 $${daily.totalCost} 已超过预算 $${BUDGET.dailyMax}`,
        recommendation: "停止非必要开发，只保留赚钱自动化运行",
      };
    }

    if (daily.status === "WARNING") {
      return {
        alert: "warning",
        message: `今日 Token 费用 $${daily.totalCost} 接近预算上限`,
        remaining: Math.round((BUDGET.dailyMax - daily.totalCost) * 100) / 100,
        recommendation: "精简会话，减少重试，优先做高 ROI 的任务",
      };
    }

    return {
      alert: "ok",
      remaining: Math.round((BUDGET.dailyMax - daily.totalCost) * 100) / 100,
    };
  }

  // ========== 节约建议 ==========
  savingsTips() {
    const daily = this.dailyReport();
    const tips = [];

    if (daily.sessions > 10) tips.push("会话过多：减少 restart，复用上下文");
    if (daily.totalOutputTokens > 500000) tips.push("输出 Token 高：要求简洁回答，避免大段代码输出");
    if (daily.totalInputTokens > 500000) tips.push("输入 Token 高：避免反复读取同一文件");

    return tips;
  }

  _groupBy(arr, key) {
    const result = {};
    for (const item of arr) {
      const k = item[key] || "other";
      if (!result[k]) result[k] = { count: 0, cost: 0 };
      result[k].count++;
      result[k].cost = Math.round((result[k].cost + item.cost) * 10000) / 10000;
    }
    return result;
  }
}

// ========== CLI ==========
if (require.main === module) {
  const monitor = new CostMonitor(path.join(__dirname, "data"));
  const cmd = process.argv[2] || "daily";

  if (cmd === "daily") {
    console.log(JSON.stringify(monitor.dailyReport(), null, 2));
  } else if (cmd === "roi") {
    console.log(JSON.stringify(monitor.roiReport(), null, 2));
  } else if (cmd === "budget") {
    console.log(JSON.stringify(monitor.checkBudget(), null, 2));
  } else if (cmd === "monthly") {
    console.log(JSON.stringify(monitor.monthlyReport(), null, 2));
  } else if (cmd === "tips") {
    console.log(monitor.savingsTips().join("\n"));
  }
}

module.exports = { CostMonitor, BUDGET, TOKEN_COST };
