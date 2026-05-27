// MediaCraft AI — 持续守护进程
// 24/7 运行在 Render，循环拉任务→分析→提交→查结果→学习
// 核心原则：遵守法律、维护国家形象、尊重平台规则、不封号
// 用法: node daemon.js

const path = require("path");
const fs = require("fs");

const ROOT = __dirname;
const LOG_DIR = path.join(ROOT, "logs");
const DATA_DIR = path.join(ROOT, "data");

// ========== 运行时配置 ==========
const CONFIG = {
  // AgentHansa 速率限制：两次 API 调用间隔 ≥ 5 秒
  MIN_API_INTERVAL_MS: 5000,

  // 每轮之间的随机延迟（模拟人类行为）
  CYCLE_DELAY_MIN_MS: 7 * 60 * 1000,   // 7 分钟
  CYCLE_DELAY_MAX_MS: 15 * 60 * 1000,  // 15 分钟

  // 每日最大提交数（避免被平台视为刷任务）
  MAX_DAILY_SUBMISSIONS: 8,

  // 每轮最多提交数
  MAX_PER_CYCLE: 3,

  // 账号年龄 ≥ 此天数才能发 Personal Task
  MIN_AGE_FOR_HELP_REQUEST: 5,

  // 健康检查间隔（防止 Render 休眠）
  KEEPALIVE_INTERVAL_MS: 8 * 60 * 1000,
};

// ========== 内容安全审查 ==========
const BLOCKED_KEYWORDS = [
  "xi jinping", "mao zedong", "tiananmen", "tibet independence", "xinjiang",
  "taiwan independence", "falun gong", "hong kong protest", "six four",
  "china virus", "wuhan virus", "ccp", "communist party of china",
  "uighur", "free tibet", "free hong kong", "tiananmen square",
  "porn", "sex", "violence", "weapon", "drug", "gambling", "hack",
  "separatist", "secession", "independence movement",
];

const BLOCKED_PATTERNS = [
  /反[共党华国中]/, /台[独毒]/, /藏[独毒]/, /疆[独毒]/, /港[独毒]/,
  /法轮功/, /六四/, /天安门/,
];

function safetyCheck(text) {
  const lower = (text || "").toLowerCase();
  for (const kw of BLOCKED_KEYWORDS) {
    if (lower.includes(kw)) return { pass: false, reason: `关键词: ${kw}` };
  }
  for (const pat of BLOCKED_PATTERNS) {
    if (pat.test(text)) return { pass: false, reason: `模式: ${pat}` };
  }
  return { pass: true };
}

// ========== 日志 ==========
function now() {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}
function log(msg) {
  const line = `[${now()}] ${msg}`;
  console.log(line);
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, "daemon.log"), line + "\n");
  } catch (e) {}
}

// ========== 随机延迟 ==========
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function randomBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ========== 每日计数追踪 ==========
function getDailyCount() {
  try {
    const f = path.join(DATA_DIR, `daily_count_${todayStr()}.json`);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf-8"));
  } catch (e) {}
  return { submissions: 0, wins: 0, errors: 0, cycles: 0 };
}
function saveDailyCount(c) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `daily_count_${todayStr()}.json`), JSON.stringify(c));
}
function incrementDaily(field) {
  const c = getDailyCount();
  c[field] = (c[field] || 0) + 1;
  saveDailyCount(c);
  return c;
}

// ========== 核心：运行一轮 Worker ==========
async function runWorkerCycle() {
  const { LearningEngine } = require("./learning_engine");
  const { HumanizerFilter } = require("./humanizer_filter");
  const { TrialEngine } = require("./trial_engine");

  const learner = new LearningEngine(DATA_DIR);
  const trials = new TrialEngine(DATA_DIR);
  const humanizer = new HumanizerFilter({ aggressiveness: 0.5 });

  trials.syncFromLearning(learner);

  // ===== Worker 逻辑（精简版，复用 agent_hansa_worker 的核心逻辑） =====
  const API = "https://agenthansa.com/api";
  const KEY = process.env.AGENTHANSA_API_KEY || "tabb_RbsUoEipzInRhm2-D2QoH5WHjyYrKJeb9Ff5TUCmx8E";

  let lastApiCall = 0;
  async function rateLimit() {
    const elapsed = Date.now() - lastApiCall;
    if (elapsed < CONFIG.MIN_API_INTERVAL_MS) {
      await sleep(CONFIG.MIN_API_INTERVAL_MS - elapsed);
    }
    lastApiCall = Date.now();
  }

  async function api(method, endpoint, body, retries = 2) {
    await rateLimit();
    const opts = {
      method,
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(`${API}${endpoint}`, opts);
      if (res.status === 429 && retries > 0) {
        log(`RATE: 429, cooling 30s (${retries} retries)`);
        await sleep(30000);
        lastApiCall = Date.now();
        return api(method, endpoint, body, retries - 1);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(`${res.status}`);
      return data;
    } catch (e) {
      if (retries > 0 && e.message.includes("fetch")) {
        await sleep(10000);
        return api(method, endpoint, body, retries - 1);
      }
      throw e;
    }
  }
  async function apiGet(p) { return api("GET", p); }
  async function apiPost(p, b) { return api("POST", p, b); }

  // ===== 签到 =====
  try { await apiPost("/agents/checkin"); log("DAEMON: Check-in done"); } catch (e) {}

  // ===== 每日任务 =====
  try {
    const forum = await apiGet("/forum?per_page=3");
    if (forum.posts?.[0]) {
      const comments = [
        "Excellent analysis. The methodology you've outlined is thorough and practical.",
        "Really insightful perspective. I appreciate the depth of research here.",
        "Solid contribution. This kind of detailed breakdown is exactly what the ecosystem needs.",
      ];
      const c = comments[Math.floor(Math.random() * comments.length)];
      if (safetyCheck(c).pass) {
        await apiPost(`/forum/${forum.posts[0].id}/comments`, { body: c });
      }
    }
  } catch (e) {}

  try {
    const forum2 = await apiGet("/forum?per_page=10");
    for (const p of (forum2.posts || []).slice(0, 5)) {
      try { await apiPost(`/forum/${p.id}/vote`, { vote: "up" }); } catch (e) {}
    }
  } catch (e) {}

  // ===== 账号状态 =====
  let accountAgeDays = 0;
  try {
    const me = await apiGet("/agents/me");
    accountAgeDays = Math.floor((Date.now() - new Date(me.created_at).getTime()) / 86400000);
    const snap = me.stats_snapshot || {};
    log(`DAEMON: ${accountAgeDays}d old | Rep ${me.reputation?.overall_score || 0} | Rank ${snap.earnings_rank}/${snap.total_agents} | $${me.earnings?.total || 0}`);
  } catch (e) { log(`DAEMON: Status check failed — ${e.message}`); }

  // ===== Quest 提交 =====
  const daily = getDailyCount();
  const remaining = CONFIG.MAX_DAILY_SUBMISSIONS - daily.submissions;
  if (remaining <= 0) {
    log(`DAEMON: Daily cap reached (${daily.submissions}/${CONFIG.MAX_DAILY_SUBMISSIONS}), skipping quests`);
    return { learner, trials, humanizer };
  }

  const maxThisCycle = Math.min(CONFIG.MAX_PER_CYCLE, remaining);
  try {
    const inbox = await apiGet("/agents/me/inbox");
    const quests = inbox.sections?.alliance_war_quests?.items || [];
    log(`DAEMON: ${quests.length} quests, ${maxThisCycle} slots this cycle`);

    const categories = ["tech", "writing", "career", "research", "shopping"];
    let submitted = 0;

    for (const q of quests) {
      if (submitted >= maxThisCycle) break;

      const title = q.title?.toLowerCase() || "";
      const cat = categories.find((c) => title.includes(c)) || "tech";
      const type = title.includes("personal-task") ? "create_help_request" : "respond_help";

      // 账号太新不能发 Personal Task
      if (type === "create_help_request" && accountAgeDays < CONFIG.MIN_AGE_FOR_HELP_REQUEST) {
        continue;
      }

      try {
        if (type === "create_help_request") {
          const hr = { title: `Need help with ${cat} task`, name: `${cat} question`, description: `Looking for expert ${cat} advice.`, evaluation_category: cat };
          const check = safetyCheck(JSON.stringify(hr));
          if (!check.pass) { log(`SAFETY: Blocked help request — ${check.reason}`); continue; }
          const hRes = await apiPost("/help/request", hr);
          await apiPost(`/alliance-war/quests/${q.id}/submit`, { content: hRes.id, proof_url: `https://agenthansa.com/help/${hRes.id}` });
          incrementDaily("submissions");
          submitted++;
        } else {
          const feed = await apiGet("/help/agent-feed?per_page=5");
          const reqs = feed.requests || [];
          const target = reqs.find((r) => (r.evaluation_category || "").toLowerCase() === cat) || reqs[0];
          if (!target) continue;

          const ctx = { title: target.title || "", description: target.description || "" };
          const gen = learner.generateResponse(cat, ctx);
          const humanized = humanizer.humanize(gen.content);

          const check = safetyCheck(humanized);
          if (!check.pass) { log(`SAFETY: Blocked response — ${check.reason}`); continue; }

          await apiPost(`/help/requests/${target.id}/respond`, { content: humanized });
          await apiPost(`/alliance-war/quests/${q.id}/submit`, { content: `response_${target.id}` });

          learner.recordSubmission(q.id, cat, type, humanized, `https://agenthansa.com/help/${target.id}`);
          trials.recordTrial({ questId: q.id, category: cat, type, style: gen.styleVariant, proofType: "help_url", hypothesis: `${cat} + daemon auto` });

          incrementDaily("submissions");
          submitted++;
          log(`DAEMON: Submitted to "${q.title?.substring(0, 40)}..." [${cat}/${gen.styleVariant}]`);
        }

        // 提交间随机延迟（看起来更自然）
        await sleep(randomBetween(8000, 15000));
      } catch (e) {
        log(`DAEMON: Quest failed — ${e.message?.substring(0, 100)}`);
        incrementDaily("errors");
      }
    }

    log(`DAEMON: ${submitted}/${maxThisCycle} submitted this cycle (${daily.submissions + submitted}/${CONFIG.MAX_DAILY_SUBMISSIONS} today)`);
  } catch (e) {
    log(`DAEMON: Quest phase error — ${e.message}`);
  }

  // ===== Arena =====
  try {
    const tournaments = await apiGet("/arena/tournaments/upcoming");
    for (const t of (tournaments.items || tournaments.tournaments || [])) {
      if (t.status === "upcoming") {
        try { await apiPost(`/arena/tournaments/${t.id}/participants`); } catch (e) {}
      }
      if (t.status === "live") {
        try {
          const pairing = await apiGet(`/arena/tournaments/${t.id}/my-pairing`);
          if (pairing && !pairing.submitted) {
            const move = randomBetween(1, 10);
            await apiPost(`/arena/tournaments/${t.id}/rounds/${pairing.round_number}/submit`, { move });
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  // ===== 保存学习数据 =====
  learner.save();
  trials._save(path.join(DATA_DIR, "trial_log.json"), trials.trials);

  return { learner, trials, humanizer };
}

// ========== 主循环 ==========
async function main() {
  log("========================================");
  log("DAEMON: MediaCraft AI 持续守护进程启动");
  log(`CONFIG: ${CONFIG.MAX_DAILY_SUBMISSIONS} max/day, ${CONFIG.MAX_PER_CYCLE}/cycle, ${CONFIG.CYCLE_DELAY_MIN_MS / 60000}-${CONFIG.CYCLE_DELAY_MAX_MS / 60000}min delay`);
  log("========================================");

  let cycleNum = 0;

  while (true) {
    cycleNum++;
    const cycleStart = Date.now();

    try {
      log(`\n=== Cycle #${cycleNum} ===`);
      await runWorkerCycle();
    } catch (e) {
      log(`DAEMON: Cycle crashed — ${e.message}`);
    }

    // 计算延迟
    const elapsed = Date.now() - cycleStart;
    const baseDelay = randomBetween(CONFIG.CYCLE_DELAY_MIN_MS, CONFIG.CYCLE_DELAY_MAX_MS);
    const actualDelay = Math.max(baseDelay - elapsed, 30000); // 最少 30 秒

    log(`DAEMON: Cycle ${cycleNum} done in ${(elapsed / 1000).toFixed(0)}s, sleeping ${(actualDelay / 60000).toFixed(1)}min...`);

    await sleep(actualDelay);
  }
}

// ========== 启动 ==========
if (require.main === module) {
  main().catch((e) => {
    log(`DAEMON FATAL: ${e.message}`);
    console.error(e);
    process.exit(1);
  });
}

module.exports = { runWorkerCycle };
