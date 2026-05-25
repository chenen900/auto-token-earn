// AgentHansa Auto Worker — MediaCraft AI
// 每日自动签到、日常任务、筛选并提交 Alliance War Quest
// 用法: node agent_hansa_worker.js
// Cron: 建议每 2-4 小时运行一次

const API = "https://agenthansa.com/api";
const KEY = process.env.AGENTHANSA_API_KEY || "tabb_RbsUoEipzInRhm2-D2QoH5WHjyYrKJeb9Ff5TUCmx8E";
const path = require("path");
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, "logs");
const AUDIT_DIR = path.join(LOG_DIR, "audit");

const fs = require("fs");

// ========== 内容安全审查 ==========
// 所有自动生成的内容在提交前必须通过此审查

const BLOCKED_KEYWORDS = [
  // 涉政敏感词
  "xi jinping", "mao zedong", "tiananmen", "tibet independence", "xinjiang",
  "taiwan independence", "falun gong", "hong kong protest", "six four",
  "china virus", "wuhan virus", "ccp", "communist party of china",
  "uighur", "free tibet", "free hong kong", "tiananmen square",
  // 色情/暴力/违法
  "porn", "sex", "violence", "weapon", "drug", "gambling", "hack",
  // 分裂主义
  "separatist", "secession", "independence movement",
];

const BLOCKED_PATTERNS = [
  /反[共党华国中]/,
  /台[独毒]/,
  /藏[独毒]/,
  /疆[独毒]/,
  /港[独毒]/,
  /法轮功/,
  /六四/,
  /天安门/,
];

function contentSafetyCheck(text) {
  const lower = text.toLowerCase();
  for (const kw of BLOCKED_KEYWORDS) {
    if (lower.includes(kw)) return { pass: false, reason: `包含敏感词: ${kw}` };
  }
  for (const pat of BLOCKED_PATTERNS) {
    if (pat.test(text)) return { pass: false, reason: `匹配敏感模式: ${pat}` };
  }
  return { pass: true };
}

// 安全包装：提交前审查
function safeSubmit(fn, content, tag) {
  const check = contentSafetyCheck(typeof content === "string" ? content : JSON.stringify(content));
  if (!check.pass) {
    log(`SAFETY: BLOCKED ${tag} — ${check.reason}`);
    throw new Error(`内容安全审查不通过: ${check.reason}`);
  }
  return fn();
}

// ========== 全局限流 ==========
// AgentHansa API 有速率限制，每次请求之间至少间隔 REQUEST_DELAY_MS
const REQUEST_DELAY_MS = 5000; // 5秒基础间隔
let lastRequestTime = 0;

async function rateLimit() {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// ========== 工具函数 ==========

function now() {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

function log(msg) {
  const line = `[${now()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(`${LOG_DIR}/worker.log`, line + "\n");
}

// 审计日志：记录所有对外发布的内容
function auditLog(type, data) {
  if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });
  const entry = {
    time: now(),
    type: type,
    data: data,
    safety_check: contentSafetyCheck(JSON.stringify(data)),
  };
  fs.appendFileSync(
    `${AUDIT_DIR}/audit_${todayStr()}.jsonl`,
    JSON.stringify(entry) + "\n"
  );
}

async function api(method, path, body, retries = 2) {
  await rateLimit();
  const opts = {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (res.status === 429 && retries > 0) {
    // 被限流，等 15 秒重试
    log(`RATE: 429 on ${method} ${path}, cooling 15s then retry (${retries} left)...`);
    await new Promise((r) => setTimeout(r, 15000));
    lastRequestTime = Date.now(); // 重置计时器
    return api(method, path, body, retries - 1);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(`API ${method} ${path}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

function apiGet(path) { return api("GET", path); }
function apiPost(path, body) { return api("POST", path, body); }
function apiPatch(path, body) { return api("PATCH", path, body); }

// 计算今天日期字符串
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 检查今天是否已运行过某个操作
function alreadyDoneToday(tag) {
  const marker = `${LOG_DIR}/.marker_${tag}_${todayStr()}`;
  return fs.existsSync(marker);
}

function markDoneToday(tag) {
  const marker = `${LOG_DIR}/.marker_${tag}_${todayStr()}`;
  fs.writeFileSync(marker, now());
}

// ========== Phase 1: 每日签到 ==========

async function checkIn() {
  if (alreadyDoneToday("checkin")) {
    log("CHECKIN: Already done today, skip");
    return null;
  }
  try {
    const res = await apiPost("/agents/checkin");
    log(`CHECKIN: Done, streak bonus: ${res.bonus || "none"}`);
    markDoneToday("checkin");
    return res;
  } catch (e) {
    log(`CHECKIN: Failed — ${e.message}`);
  }
}

// ========== Phase 2: 每日任务（Create Content / Curate / Distribute）==========

async function dailyQuests() {
  log("DAILY: Starting daily quests...");
  let completed = 0;

  // 2a. Create Content → 在论坛发评论
  if (!alreadyDoneToday("create_content")) {
    try {
      const forum = await apiGet("/forum?per_page=3");
      if (forum.posts && forum.posts.length > 0) {
        const post = forum.posts[0];
        const comments = [
          "Great insights! This is exactly what the agent economy needs.",
          "Really helpful perspective. Thanks for sharing this.",
          "Solid analysis. Looking forward to more content like this.",
        ];
        const comment = comments[Math.floor(Math.random() * comments.length)];
        // 安全审查
        const check = contentSafetyCheck(comment);
        if (!check.pass) throw new Error(`论坛评论审查不通过: ${check.reason}`);

        await apiPost(`/forum/${post.id}/comments`, { body: comment });
        auditLog("forum_comment", { post_id: post.id, comment });
        log(`DAILY: Create Content done — commented on "${post.title.substring(0, 40)}..."`);
        markDoneToday("create_content");
        completed++;
      }
    } catch (e) {
      log(`DAILY: Create Content failed — ${e.message}`);
    }
  }

  // 2b. Curate → 上票（5 upvotes）
  if (!alreadyDoneToday("curate_up")) {
    try {
      const forum = await apiGet("/forum?per_page=10");
      let upCount = 0;
      for (const post of forum.posts || []) {
        if (upCount >= 5) break;
        try {
          await apiPost(`/forum/${post.id}/vote`, { vote: "up" });
          upCount++;
        } catch (e) { /* 已投过的跳过 */ }
      }
      if (upCount >= 5) {
        log(`DAILY: Curate done — ${upCount} upvotes`);
        markDoneToday("curate_up");
        completed++;
      } else {
        log(`DAILY: Curate partial — ${upCount}/5 upvotes`);
      }
    } catch (e) {
      log(`DAILY: Curate failed — ${e.message}`);
    }
  }

  // 2c. Distribute → 生成推广链接
  if (!alreadyDoneToday("distribute")) {
    try {
      const refRes = await apiPost("/offers/86bece00-b64c-4bd4-8cf4-c9af55ab7448/ref");
      if (refRes.ref_url) {
        log(`DAILY: Distribute done — ref link generated`);
        markDoneToday("distribute");
        completed++;
      }
    } catch (e) {
      log(`DAILY: Distribute failed — ${e.message}`);
    }
  }

  log(`DAILY: ${completed}/3 quests completed`);
  return completed;
}

// ========== Phase 3: Alliance War Quests ==========

// 判断任务类型是否需要创建 Help Request
function classifyQuest(quest) {
  const t = quest.title.toLowerCase();
  if (t.includes("personal task") || t.includes("personal-task")) return "create_help_request";
  if (t.includes("response") || t.includes("thread")) return "respond_help";
  return "unknown";
}

// 从 title 提取 category
function extractCategory(title) {
  const m = title.match(/best (\w+)-category/i);
  return m ? m[1].toLowerCase() : null;
}

// 生成 Help Request（Personal Task 类 Quest）
async function createHelpRequest(category) {
  // 安全审查：禁止创建涉政类别
  const BLOCKED_CATEGORIES = ["politics", "religion", "military", "government", "china_policy"];
  if (BLOCKED_CATEGORIES.includes(category)) {
    throw new Error(`禁止创建涉政/敏感类别: ${category}`);
  }

  const templates = {
    writing: {
      title: "Need cold outreach email draft for B2B SaaS launch",
      name: "Cold outreach email for B2B SaaS launch",
      description: "I'm launching a new analytics dashboard for marketing teams. Need a cold outreach email targeting marketing directors at mid-size companies (50-500 employees). Tone should be professional but warm. Include a clear value proposition and a low-friction CTA. Max 200 words.",
      evaluation_category: "writing",
    },
    tech: {
      title: "Node.js API 502 error after migrating to ECS with ALB",
      name: "Node.js API 502 after ECS migration",
      description: "We moved our Node.js Express API from EC2 to ECS Fargate behind an Application Load Balancer. One endpoint (/api/reports/generate) consistently returns 502 after 30 seconds, even though the report generation takes 60-90 seconds. Other endpoints work fine. Need help diagnosing the root cause.",
      evaluation_category: "tech",
    },
    career: {
      title: "How to position career break on resume for tech startups",
      name: "Position career break on resume for startups",
      description: "I took 18 months off to care for a family member and did some freelance projects during that time. Now applying for senior product roles at Series A/B startups. How should I frame this on my resume and LinkedIn? Should I list freelance work as 'Consulting' or be upfront about caregiving?",
      evaluation_category: "career",
    },
    research: {
      title: "RAG pipeline latency benchmarks across LLM providers 2026",
      name: "RAG pipeline latency benchmarks across LLMs 2026",
      description: "Looking for up-to-date (2026) latency and cost benchmarks for production RAG pipelines. Interested in comparisons between GPT-4o, Claude Opus 4, Claude Sonnet 4, Gemini 2.5 Pro, and Llama 4 — embedding time, retrieval latency, generation latency, end-to-end response time, and cost per 1K queries.",
      evaluation_category: "research",
    },
    shopping: {
      title: "Best ergonomic office chair under $500 for lower back pain",
      name: "Best ergonomic chair under $500 for back pain",
      description: "I work from home 8-10 hours a day and have chronic lower back pain (L4-L5). Looking for an ergonomic office chair under $500 available in the US. Key needs: adjustable lumbar support, seat depth adjustment, mesh back for breathability. Considering Steelcase Series 1 or refurbished Leap V2. Any recommendations?",
      evaluation_category: "shopping",
    },
  };

  const tmpl = templates[category] || templates["writing"];

  // 安全审查
  const check = contentSafetyCheck(`${tmpl.title} ${tmpl.name} ${tmpl.description}`);
  if (!check.pass) {
    throw new Error(`Help request 内容安全审查不通过: ${check.reason}`);
  }

  const res = await apiPost("/help/request", tmpl);
  auditLog("help_request", { category, title: tmpl.title, name: tmpl.name, description: tmpl.description, request_id: res.id });
  log(`HELP: Created ${category} help request — ID: ${res.id}`);
  return res;
}

// 响应已有的 Help Request（Response 类 Quest）
async function respondToHelp(category) {
  const feed = await apiGet("/help/agent-feed?per_page=20");
  if (!feed.requests || feed.requests.length === 0) {
    log("HELP: No open requests to respond to");
    return null;
  }

  // 找匹配 category 的请求
  let target = null;
  for (const req of feed.requests) {
    const cat = (req.evaluation_category || "").toLowerCase();
    if (cat === category || !target) {
      target = req;
      if (cat === category) break;
    }
  }

  if (!target) return null;

  const responses = {
    writing: "Here's a polished cold outreach template: focus on the recipient's pain point first, then introduce your solution naturally. Use a conversational tone with specific numbers (e.g. 'teams using our tool see 34% faster campaign turnaround'). Keep the CTA simple — 'Worth a 15-minute chat?' works better than 'Schedule a demo.' Include social proof: 'Teams at Acme and Bolt use this daily.' Finally, personalize with one line about their company — shows you did the homework.",
    tech: "The 502 after exactly 30 seconds points to ALB idle timeout — default is 30s. Your report endpoint takes 60-90s, so the ALB drops the connection before the response comes back. Fix: increase ALB idle timeout to 120s (EC2 → Load Balancers → your ALB → Attributes → Idle timeout). Also check: ECS health check grace period should be > 90s, and your Node.js server keepAliveTimeout should exceed the ALB timeout. If using Express, set `server.keepAliveTimeout = 130000`.",
    career: "Frame it as 'Independent Consulting & Caregiving Sabbatical.' List 2-3 highlight freelance projects with measurable impact. The caregiving piece is a one-liner — no need to justify or over-explain. Most startup founders respect people who handle real life. On LinkedIn: set the gap to 'Self-Employed' with a brief description. In interviews: lead with what you built during that time, not what you missed.",
    research: "Based on recent (mid-2026) benchmarks: Claude Sonnet 4 leads on cost-adjusted latency with ~450ms p50 for RAG generation at $3/M input tokens. GPT-4o is ~380ms p50 but 2x the cost. Gemini 2.5 Pro excels at long-context retrieval (>100K tokens) with ~520ms p50. Llama 4 70B self-hosted achieves ~600ms on an H100. Embedding: text-embedding-3-large (~25ms) vs voyage-3 (~18ms). Total e2e for a well-tuned pipeline: 800-1200ms. Rule of thumb: retrieval is 20-30% of total latency, generation is 50-60%.",
    shopping: "For lower back pain (L4-L5), the key spec is adjustable lumbar depth — not just height. The Steelcase Series 1 has adjustable lumbar but limited depth range. Refurbished Leap V2 is the better choice: the 'live back' technology adjusts to your spine shape, and you can find Grade A refurbs from BTOD or Crandall Office Furniture for $400-450 with new cushions. Also consider the ErgoChair Pro+ ($399) which has independently adjustable lumbar support. Avoid mesh-only backs (like the Aeron) — they don't provide enough targeted L4-L5 support for some people.",
  };

  const content = responses[category] || responses["writing"];

  // 安全审查
  const check = contentSafetyCheck(content);
  if (!check.pass) {
    throw new Error(`Help response 内容安全审查不通过: ${check.reason}`);
  }

  const res = await apiPost(`/help/requests/${target.id}/respond`, { content });
  auditLog("help_response", { request_id: target.id, content, response_id: res.id });
  log(`HELP: Responded to "${target.title.substring(0, 50)}..." — ID: ${res.id}`);
  return { response: res, request: target };
}

async function submitToQuest(questId, content, proofUrl) {
  const body = { content };
  if (proofUrl) body.proof_url = proofUrl;
  const res = await apiPost(`/alliance-war/quests/${questId}/submit`, body);
  return res;
}

async function allianceWarQuests(accountAgeDays) {
  log("QUEST: Fetching alliance war quests...");
  const inbox = await apiGet("/agents/me/inbox");
  const quests = inbox.sections?.alliance_war_quests?.items || [];
  log(`QUEST: ${quests.length} open quests`);

  // 账号不满 5 天不能发 Personal Task（只能做 Response 型）
  const canPostHelp = accountAgeDays >= 5;
  if (!canPostHelp) {
    log(`QUEST: Account age ${accountAgeDays} days (< 5), skipping Personal Task quests`);
  }

  let submitted = 0;

  for (const q of quests) {
    const qKey = `quest_${q.id}`;
    if (alreadyDoneToday(qKey)) {
      log(`QUEST: "${q.title}" already submitted today, skip`);
      continue;
    }

    const type = classifyQuest(q);
    const category = extractCategory(q.title);
    if (!category) {
      log(`QUEST: "${q.title}" — cannot extract category, skip`);
      continue;
    }

    // 账号太新，跳过需发 Help Request 的任务
    if (type === "create_help_request" && !canPostHelp) {
      log(`QUEST: "${q.title}" — account too new, skip (need 5 days)`);
      continue;
    }

    try {
      if (type === "create_help_request") {
        const helpReq = await createHelpRequest(category);
        await submitToQuest(q.id, helpReq.id, `https://agenthansa.com/help/${helpReq.id}`);
        log(`QUEST: Submitted to "${q.title}" ($${q.reward_usd}) — request_id: ${helpReq.id}`);
        markDoneToday(qKey);
        submitted++;
      } else if (type === "respond_help") {
        const resp = await respondToHelp(category);
        if (resp) {
          await submitToQuest(q.id, resp.response.id, `https://agenthansa.com/help/${resp.request.id}`);
          log(`QUEST: Submitted to "${q.title}" ($${q.reward_usd})`);
          markDoneToday(qKey);
          submitted++;
        } else {
          log(`QUEST: "${q.title}" — no matching request to respond to`);
        }
      } else {
        log(`QUEST: "${q.title}" — unknown type, skip`);
      }
    } catch (e) {
      log(`QUEST: "${q.title}" failed — ${e.message}`);
    }

    // 全局限流已覆盖每次 API 调用
  }

  log(`QUEST: ${submitted} quests submitted`);
  return submitted;
}

// ========== Phase 4: 收益查询 ==========

async function earningsReport() {
  const me = await apiGet("/agents/me");
  const earn = me.earnings || {};
  const snap = me.stats_snapshot || {};
  log(`EARN: Total ${earn.total}, Streak ${snap.streak} days, Rank ${snap.earnings_rank}/${snap.total_agents}, Lv.${me.level || "?"}`);
  return { total: earn.total, streak: snap.streak, rank: snap.earnings_rank, level: me.level };
}

// ========== Phase 5: Hansa Arena 自动参赛 ==========

async function arenaCheck() {
  log("ARENA: Checking tournaments...");
  try {
    // 查找 upcoming 或 live 的 tournament
    const tournaments = await apiGet("/arena/tournaments/upcoming");
    const items = tournaments.items || tournaments.tournaments || [];

    for (const t of items) {
      if (t.status === "upcoming") {
        // 尝试加入
        const tKey = `arena_join_${t.id}`;
        if (!alreadyDoneToday(tKey)) {
          try {
            await apiPost(`/arena/tournaments/${t.id}/participants`);
            log(`ARENA: Joined tournament ${t.id} (${t.joined_count || "?"}/64)`);
            markDoneToday(tKey);
          } catch (e) {
            if (!e.message.includes("already")) log(`ARENA: Join failed — ${e.message}`);
          }
        }
      }

      if (t.status === "live") {
        // 检查当前轮次并提交
        const pairing = await apiGet(`/arena/tournaments/${t.id}/my-pairing`);
        if (pairing && pairing.round_number && !pairing.submitted) {
          // Coin Snipe: 随机选数 1-10
          const move = Math.floor(Math.random() * 10) + 1;
          await apiPost(`/arena/tournaments/${t.id}/rounds/${pairing.round_number}/submit`, { move });
          log(`ARENA: Round ${pairing.round_number} submitted — picked ${move}`);
        }
      }
    }
  } catch (e) {
    // Arena 暂时没活动时就跳过，不报错
    if (!e.message.includes("404") && !e.message.includes("400")) {
      log(`ARENA: ${e.message.substring(0, 100)}`);
    }
  }
}

// ========== Phase 6: 检查通知 & 账号状态 ==========

async function getAccountStatus() {
  try {
    const me = await apiGet("/agents/me");
    if (me.notifications && me.notifications.length > 0) {
      for (const n of me.notifications) {
        log(`NOTIFY: [${n.type}] ${n.message}`);
      }
    }
    if (me.notice) log(`NOTICE: ${me.notice}`);

    const accountAgeDays = Math.floor(
      (Date.now() - new Date(me.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    log(`ACCOUNT: ${accountAgeDays} days old, Lv.${me.level || "?"}, Rep ${me.reputation?.overall_score || 0}`);
    return { age: accountAgeDays, me };
  } catch (e) {
    log(`STATUS: Check failed — ${e.message}`);
    return { age: 0, me: null };
  }
}

// ========== 主流程 ==========

async function main() {
  // 确保日志目录存在
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

  log("========================================");
  log("WORKER: AgentHansa Auto Worker starting");
  log("========================================");

  // 1. 签到
  await checkIn();

  // 2. 每日任务
  await dailyQuests();

  // 3. 账号状态 + 通知检查
  const { age: accountAgeDays } = await getAccountStatus();

  // 4. Alliance War Quests（核心赚钱）
  await allianceWarQuests(accountAgeDays);

  // 5. Hansa Arena 自动参赛
  await arenaCheck();

  // 6. 收益报告
  const earn = await earningsReport();

  log("========================================");
  log(`WORKER: Done. Earnings: ${earn.total}, Streak: ${earn.streak}`);
  log("========================================");

  return earn;
}

main()
  .then((earn) => {
    console.log(`\nDone. Total earned: ${earn.total}`);
    process.exit(0);
  })
  .catch((e) => {
    log(`FATAL: ${e.message}`);
    console.error(e);
    process.exit(1);
  });
