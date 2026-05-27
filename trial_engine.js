// Trial Engine — MediaCraft AI
// 高频试错：每次提交 = 一次实验，记录假设和结果，自动总结
// 用法: const trials = new TrialEngine(DATA_DIR);

const fs = require("fs");
const path = require("path");

class TrialEngine {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.trialPath = path.join(dataDir, "trial_log.json");
    this.insightsPath = path.join(dataDir, "trial_insights.json");
    this.trials = this._load(this.trialPath, []);
    this.insights = this._load(this.insightsPath, { patterns: [], lastAnalysis: null });
  }

  _load(filePath, fallback) {
    try {
      if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {}
    return fallback;
  }

  _save(filePath, data) {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  // ========== 记录实验 ==========

  recordTrial({ platform, questId, category, type, style, proofType, hypothesis }) {
    const trial = {
      id: `T${Date.now()}`,
      time: new Date().toISOString(),
      platform: platform || "agenthansa",
      questId,
      category,
      type,
      style,          // 响应风格变体
      proofType,      // "devto" | "help_url" | "none"
      hypothesis,     // 我们的假设
      result: null,   // 待填充
      reward: 0,
      duration: null, // 从提交到结果的时间
    };
    this.trials.push(trial);
    // 保留最近 500 条
    if (this.trials.length > 500) this.trials = this.trials.slice(-500);
    this._save(this.trialPath, this.trials);
    return trial;
  }

  // ========== 记录结果 ==========

  recordResult(trialId, { won, reward, reason }) {
    const trial = this.trials.find((t) => t.id === trialId);
    if (!trial) return null;

    trial.result = won ? "won" : "lost";
    trial.reward = reward || 0;
    trial.reason = reason || "";
    trial.duration = Date.now() - new Date(trial.time).getTime();
    this._save(this.trialPath, this.trials);

    // 触发实时分析
    if (this.trials.filter((t) => t.result).length % 10 === 0) {
      this.analyze();
    }

    return trial;
  }

  // ========== 批量记录（从 learning_engine 同步） ==========

  syncFromLearning(learner) {
    const memory = learner.memory;
    // 从 learner 的 submissions + wins 重建最近的试错数据
    for (const sub of memory.submissions.slice(-50)) {
      const existing = this.trials.find((t) => t.questId === sub.questId);
      if (!existing) {
        const trial = this.recordTrial({
          questId: sub.questId,
          category: sub.category || "unknown",
          type: sub.type || "unknown",
          proofType: sub.proofUrl && sub.proofUrl.includes("dev.to") ? "devto"
            : sub.proofUrl ? "help_url" : "none",
          hypothesis: `${sub.category} + quality response should win`,
        });
        // 检查是否有对应的 win
        const win = memory.wins.find((w) => w.questId === sub.questId);
        if (win) {
          this.recordResult(trial.id, { won: true, reward: win.reward });
        }
      }
    }
  }

  // ========== 分析引擎 ==========

  analyze() {
    const completed = this.trials.filter((t) => t.result);
    if (completed.length < 5) return null; // 数据不够

    const wins = completed.filter((t) => t.result === "won");
    const losses = completed.filter((t) => t.result === "lost");

    const analysis = {
      analyzedAt: new Date().toISOString(),
      totalTrials: completed.length,
      winRate: ((wins.length / completed.length) * 100).toFixed(1) + "%",
      totalEarned: wins.reduce((s, t) => s + t.reward, 0).toFixed(2),

      // 按类别
      byCategory: {},
      // 按证明类型
      byProofType: {},
      // 按响应风格
      byStyle: {},
      // 成功模式
      winningPatterns: [],
      // 失败模式
      losingPatterns: [],
      // 建议
      recommendations: [],
    };

    // 分组分析
    for (const t of completed) {
      const cat = t.category || "unknown";
      if (!analysis.byCategory[cat]) analysis.byCategory[cat] = { tried: 0, won: 0, earned: 0 };
      analysis.byCategory[cat].tried++;
      if (t.result === "won") {
        analysis.byCategory[cat].won++;
        analysis.byCategory[cat].earned += t.reward;
      }
    }

    for (const t of completed) {
      const pt = t.proofType || "none";
      if (!analysis.byProofType[pt]) analysis.byProofType[pt] = { tried: 0, won: 0 };
      analysis.byProofType[pt].tried++;
      if (t.result === "won") analysis.byProofType[pt].won++;
    }

    // 提取成功模式
    const highWinCats = Object.entries(analysis.byCategory)
      .filter(([, d]) => d.tried >= 3 && d.won / d.tried > 0.2)
      .sort((a, b) => b[1].won / b[1].tried - a[1].won / a[1].tried)
      .map(([cat]) => cat);

    if (highWinCats.length > 0) {
      analysis.winningPatterns.push(`高胜率类别: ${highWinCats.join(", ")}`);
      analysis.recommendations.push(`策略: 集中火力在 ${highWinCats[0]}，减少其他类别尝试`);
    }

    // 提取失败模式
    const lowWinCats = Object.entries(analysis.byCategory)
      .filter(([, d]) => d.tried >= 5 && d.won / d.tried === 0)
      .map(([cat]) => cat);

    if (lowWinCats.length > 0) {
      analysis.losingPatterns.push(`零胜率类别: ${lowWinCats.join(", ")}`);
      analysis.recommendations.push(`建议: 停止在 ${lowWinCats.join(", ")} 上浪费提交额度`);
    }

    // Dev.to proof 效果分析
    if (analysis.byProofType.devto && analysis.byProofType.help_url) {
      const devtoRate = analysis.byProofType.devto.won / analysis.byProofType.devto.tried;
      const helpRate = analysis.byProofType.help_url.won / analysis.byProofType.help_url.tried;
      if (devtoRate > helpRate) {
        analysis.winningPatterns.push(
          `Dev.to proof 胜率 ${(devtoRate * 100).toFixed(0)}% vs help_url ${(helpRate * 100).toFixed(0)}%`
        );
      }
    }

    // 高频试错效果
    if (completed.length >= 20) {
      const recent = completed.slice(-10);
      const older = completed.slice(0, -10);
      const recentRate = recent.filter((t) => t.result === "won").length / recent.length;
      const olderRate = older.filter((t) => t.result === "won").length / older.length;
      if (recentRate > olderRate) {
        analysis.winningPatterns.push(`近期胜率提升: ${(recentRate * 100).toFixed(0)}% vs 早期 ${(olderRate * 100).toFixed(0)}%`);
      }
    }

    // 保存
    this.insights = {
      patterns: [...this.insights.patterns, ...analysis.winningPatterns, ...analysis.losingPatterns].slice(-30),
      lastAnalysis: analysis.analyzedAt,
      summary: analysis,
    };
    this._save(this.insightsPath, this.insights);

    return analysis;
  }

  // ========== 获取最新洞察 ==========

  getLatestInsights() {
    if (this.insights.summary) return this.insights.summary;
    return this.analyze();
  }

  // ========== 生成假设（探索策略） ==========

  generateHypothesis(strategy) {
    const completed = this.trials.filter((t) => t.result);
    const triedCategories = [...new Set(completed.map((t) => t.category))];

    // 找未尝试过的类别
    const allCategories = ["tech", "writing", "career", "research", "shopping"];
    const untried = allCategories.filter((c) => !triedCategories.includes(c));

    if (untried.length > 0 && Math.random() < 0.3) {
      // 30% 概率尝试新类别
      return {
        category: untried[Math.floor(Math.random() * untried.length)],
        hypothesis: `探索新类别 ${untried[0]}，验证是否比已知类别更有机会`,
        isExploration: true,
      };
    }

    // 70% 概率深耕已知高胜率类别
    const insights = this.getLatestInsights();
    const bestCat = insights?.winningPatterns?.[0]?.includes("类别")
      ? insights.winningPatterns[0].split(": ")[1]?.split(", ")[0]
      : strategy.preferredCategories[0];

    return {
      category: bestCat || "tech",
      hypothesis: `深耕高胜率类别 ${bestCat}，用最佳风格 + Dev.to proof`,
      isExploration: false,
    };
  }

  // ========== 日报 ==========

  dailyReport() {
    const today = new Date().toISOString().substring(0, 10);
    const todayTrials = this.trials.filter((t) => t.time.startsWith(today));
    const completed = todayTrials.filter((t) => t.result);
    const won = completed.filter((t) => t.result === "won");

    return {
      date: today,
      trials: todayTrials.length,
      completed: completed.length,
      won: won.length,
      earned: won.reduce((s, t) => s + t.reward, 0).toFixed(2),
      winRate: completed.length > 0
        ? ((won.length / completed.length) * 100).toFixed(1) + "%"
        : "pending",
      byCategory: this._countBy(todayTrials, "category"),
      byProofType: this._countBy(todayTrials, "proofType"),
    };
  }

  _countBy(trials, field) {
    const result = {};
    for (const t of trials) {
      const key = t[field] || "unknown";
      if (!result[key]) result[key] = 0;
      result[key]++;
    }
    return result;
  }

  // ========== 导出供 Worker 日志输出 ==========

  summary() {
    const report = this.dailyReport();
    const insights = this.getLatestInsights();
    return {
      daily: report,
      overall: insights ? {
        totalTrials: insights.totalTrials,
        winRate: insights.winRate,
        totalEarned: insights.totalEarned,
        recommendations: insights.recommendations,
      } : null,
    };
  }
}

module.exports = { TrialEngine };

// CLI 模式
if (require.main === module) {
  const engine = new TrialEngine(path.join(__dirname, "data"));
  const cmd = process.argv[2] || "report";

  if (cmd === "report") {
    console.log(JSON.stringify(engine.summary(), null, 2));
  } else if (cmd === "analyze") {
    const analysis = engine.analyze();
    console.log(JSON.stringify(analysis, null, 2));
  } else if (cmd === "insights") {
    console.log(JSON.stringify(engine.insights, null, 2));
  } else {
    console.log("Usage: node trial_engine.js [report|analyze|insights]");
  }
}
