// dealwork.ai Auto Worker — MediaCraft AI
// 自动扫任务、投标、接单、交付
// 用法: node dealwork_worker.js

const API = "https://dealwork.ai/api/v1";
const KEY = process.env.DEALWORK_API_KEY || "ak_d351c9ceecb3d9886a7e19a565bc47cdf482ada8c183500b";
const AGENT_ID = "afa2fe4d-d4a0-464f-9627-0ef57f2da1b2";
const path = require("path");
const fs = require("fs");
const LOG_DIR = path.join(__dirname, "logs");
const AUDIT_DIR = path.join(LOG_DIR, "audit");

// ========== 内容安全审查 ==========
const BLOCKED_KEYWORDS = [
  "xi jinping", "mao zedong", "tiananmen", "tibet independence", "xinjiang",
  "taiwan independence", "falun gong", "china virus", "wuhan virus",
  "uighur", "free tibet", "free hong kong", "tiananmen square",
  "porn", "sex", "violence", "weapon", "drug", "gambling", "hack",
  "separatist", "secession",
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

// ========== 工具函数 ==========
function now() {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

function log(msg) {
  const line = `[${now()}] ${msg}`;
  console.log(line);
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(`${LOG_DIR}/dealwork.log`, line + "\n");
}

function auditLog(type, data) {
  if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });
  const today = new Date().toISOString().substring(0, 10);
  const entry = { time: now(), type, data, safety_check: contentSafetyCheck(JSON.stringify(data)) };
  fs.appendFileSync(`${AUDIT_DIR}/dw_audit_${today}.jsonl`, JSON.stringify(entry) + "\n");
}

const REQUEST_DELAY_MS = 5000;
let lastRequestTime = 0;

async function rateLimit() {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

async function api(method, pathStr, body, retries = 2) {
  await rateLimit();
  const opts = {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${pathStr}`, opts);
  if (res.status === 429 && retries > 0) {
    log(`RATE: 429 on ${method} ${pathStr}, cooling 15s...`);
    await new Promise((r) => setTimeout(r, 15000));
    lastRequestTime = Date.now();
    return api(method, pathStr, body, retries - 1);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(`API ${method} ${pathStr}: ${res.status} ${JSON.stringify(data).substring(0, 200)}`);
  return data;
}

function apiGet(p) { return api("GET", p); }
function apiPost(p, b) { return api("POST", p, b); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function alreadyDoneToday(tag) {
  const marker = path.join(LOG_DIR, `.dw_marker_${tag}_${todayStr()}`);
  return fs.existsSync(marker);
}

function markDoneToday(tag) {
  const marker = path.join(LOG_DIR, `.dw_marker_${tag}_${todayStr()}`);
  fs.writeFileSync(marker, now());
}

// ========== 技能匹配 ==========
const OUR_TAGS = ["writing", "translation", "research", "documentation", "seo", "marketing", "business", "bilingual", "chinese", "english"];

function matchJob(job) {
  const title = (job.title || "").toLowerCase();
  const desc = (job.description || "").toLowerCase();
  const tags = (job.tags || []).map((t) => t.toLowerCase());

  const score = OUR_TAGS.reduce((s, tag) => {
    if (title.includes(tag)) return s + 3;
    if (desc.includes(tag)) return s + 2;
    if (tags.includes(tag)) return s + 2;
    return s;
  }, 0);

  // 排除纯编程任务
  const codingOnly = /^(coding|programming|development)$/i;
  if (job.category && codingOnly.test(job.category) && score < 5) return 0;

  return score;
}

function generateBid(job) {
  const title = (job.title || "").toLowerCase();
  // dealwork.ai jobs use fixedPrice or budgetMin/budgetMax
  const budget = parseFloat(job.fixedPrice) || parseFloat(job.budgetMin) || 15;
  const bidAmount = job.fixedPrice ? budget : Math.min(budget, Math.max(5, Math.floor(budget * 0.85)));

  let pitch = "";
  if (title.includes("translation") || title.includes("translate") || title.includes("bilingual") || title.includes("chinese")) {
    pitch = `I specialize in EN↔CN bilingual content with native-level fluency in both languages. Can deliver polished, culturally-adapted ${job.category || "content"} within 1-4 hours. Business, technical, and marketing translation experience.`;
  } else if (title.includes("research") || title.includes("market") || title.includes("analysis")) {
    pitch = `Professional research and analysis with cited sources. I deliver comprehensive reports covering competitive intelligence, market sizing, and strategic recommendations. Delivery in Markdown or structured format within 1-4 hours.`;
  } else if (title.includes("documentation") || title.includes("api")) {
    pitch = `Technical documentation specialist. I write clear, structured API docs, developer guides, and product documentation. Experienced with OpenAPI, Markdown, and developer-facing content.`;
  } else if (title.includes("seo") || title.includes("content") || title.includes("blog") || title.includes("article")) {
    pitch = `SEO-optimized content writer with research-backed articles. I write engaging blog posts, technical content, and marketing copy that ranks and converts.`;
  } else {
    pitch = `Professional content specialist with bilingual EN↔CN capabilities. I deliver high-quality ${job.category || "writing"} within 1-4 hours. Research-backed, publication-ready output.`;
  }

  const check = contentSafetyCheck(pitch);
  if (!check.pass) throw new Error(`Bid content safety: ${check.reason}`);

  return {
    proposedAmount: String(bidAmount),
    proposalText: pitch,
    deliveryEstimate: "1-4 hours",
  };
}

// ========== 主流程 ==========

async function checkWallet() {
  try {
    const w = await apiGet("/wallet/balance");
    log(`WALLET: Balance ${JSON.stringify(w)}`);
    return w;
  } catch (e) {
    log(`WALLET: Check failed — ${e.message}`);
  }
}

async function browseAndBid() {
  log("JOBS: Scanning open jobs...");
  try {
    const res = await apiGet("/jobs?status=bidding&sort=newest&per_page=10");
    const jobs = res.data || res.jobs || [];
    log(`JOBS: ${jobs.length} open jobs`);

    let bidsPlaced = 0;
    for (const job of jobs) {
      const jKey = `dw_bid_${job.id}`;
      if (alreadyDoneToday(jKey)) continue;

      const score = matchJob(job);
      if (score < 5) {
        log(`JOBS: "${job.title}" score=${score}, skip`);
        continue;
      }

      try {
        const bid = generateBid(job);
        await apiPost(`/jobs/${job.id}/bids`, bid);
        log(`JOBS: Bid $${bid.amount} on "${job.title}" (score=${score})`);
        auditLog("bid", { job_id: job.id, job_title: job.title, bid });
        markDoneToday(jKey);
        bidsPlaced++;
      } catch (e) {
        log(`JOBS: Bid on "${job.title}" failed — ${e.message}`);
      }
    }
    log(`JOBS: ${bidsPlaced} bids placed`);
    return bidsPlaced;
  } catch (e) {
    log(`JOBS: Browse failed — ${e.message}`);
    return 0;
  }
}

async function checkContracts() {
  log("CONTRACT: Checking active contracts...");
  try {
    const res = await apiGet("/contracts?role=worker&status=active");
    const contracts = res.data || res.contracts || [];
    log(`CONTRACT: ${contracts.length} active contracts`);

    for (const c of contracts) {
      log(`CONTRACT: ${c.id} — "${c.jobTitle || "unknown"}" status=${c.status}`);
    }
    return contracts;
  } catch (e) {
    log(`CONTRACT: Check failed — ${e.message}`);
    return [];
  }
}

async function main() {
  log("========================================");
  log("WORKER: dealwork.ai Auto Worker starting");
  log("========================================");

  await checkWallet();
  await browseAndBid();

  // 合约检查（投标被接受后会自动出现在 contracts 列表）
  // 完整交付流程在后续版本实现
  await checkContracts();

  log("========================================");
  log("WORKER: dealwork.ai cycle complete");
  log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    log(`FATAL: ${e.message}`);
    process.exit(1);
  });
