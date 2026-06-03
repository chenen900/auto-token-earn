// pin_quests.js — 超轻量 quest 嗅探器
// 只做一件事：高频轮询 inbox → 发现 quest → 立刻存入管线
// 与主 daemon 并行运行，互不干扰
const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const LOG_FILE = path.join(ROOT, "logs", "pin.log");
const LOCK_FILE = path.join(ROOT, "data", "pin.lock");

// 从 daemon 读取 API key（不硬编码）
const daemonSrc = fs.readFileSync(path.join(ROOT, "daemon_simple.js"), "utf-8");
const keyMatch = daemonSrc.match(/AGENTHANSA_API_KEY\s*\|\|\s*"([^"]+)"/);
const KEY = process.env.AGENTHANSA_API_KEY || (keyMatch ? keyMatch[1] : null);

if (!KEY) { console.error("NO API KEY FOUND"); process.exit(1); }

function log(msg) {
  const line = "[" + new Date().toISOString().substring(11, 19) + "] PIN " + msg;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch(e) {}
}

function get(p) {
  return new Promise(r => {
    https.get({hostname:"agenthansa.com",path:p,headers:{Authorization:"Bearer "+KEY},timeout:8000}, res => {
      let d=""; res.on("data",c=>d+=c); res.on("end",()=>{ try { r(JSON.parse(d)); } catch(e) { r(null); } });
    }).on("error",()=>r(null));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 进程锁
function acquireLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = parseInt(fs.readFileSync(LOCK_FILE, "utf-8"));
      try { process.kill(pid, 0); return false; } catch(e) {}
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
    return true;
  } catch(e) { return true; }
}
function releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch(e) {}
}
process.on("exit", releaseLock);
process.on("SIGINT", () => { releaseLock(); process.exit(); });

// 保存 quest 到管线 inbox
const INBOX = path.join(ROOT, "data", "quests_inbox");
const SIGNAL_FILE = path.join(ROOT, "data", ".new_quests_signal"); // 按铃文件
function saveToInbox(q) {
  if (!fs.existsSync(INBOX)) fs.mkdirSync(INBOX, { recursive: true });
  const file = path.join(INBOX, (q.id || "q_" + Date.now()) + ".json");
  if (fs.existsSync(file)) return false; // 已存在，跳过

  const record = {
    id: q.id,
    title: q.title || "",
    description: q.description || "",
    reward_amount: q.reward_amount,
    reward_currency: q.currency || "USD",
    status: q.status,
    category: q.category || "",
    platforms: q.platforms || [],
    tags: q.tags || [],
    deadline: q.deadline,
    created_at: q.created_at,
    pinned_at: new Date().toISOString(),
    raw: q
  };
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  // 🔔 按铃：写入信号文件，Claude cron 检测到这个文件就知道有新任务
  try { fs.writeFileSync(SIGNAL_FILE, JSON.stringify({ time: new Date().toISOString(), count: 1 })); } catch(e) {}
  return true;
}

async function scan() {
  try {
    const inbox = await get("/api/agents/me/inbox");
    if (!inbox?.sections) return { found: 0 };

    const sections = inbox.sections;
    let total = 0, saved = 0;

    // 扫描所有区
    const sources = [
      { key: "alliance_war_quests", name: "AW" },
      { key: "side_quests", name: "SIDE" },
      { key: "engagement", name: "ENG" },
      { key: "personal", name: "PER" },
    ];

    for (const src of sources) {
      const items = sections[src.key]?.items || [];
      for (const q of items) {
        total++;
        q._section = src.key;
        if (saveToInbox(q)) saved++;
      }
    }

    // 也查 alliance-war 列表（可能有 inbox 里没出现的 open quest）
    const awList = await get("/api/alliance-war/quests?page=1&per_page=25");
    const awQuests = awList?.quests || [];
    for (const q of awQuests) {
      if (q.status === "open") {
        total++;
        q._section = "alliance_war";
        if (saveToInbox(q)) saved++;
      }
    }

    return { found: total, saved };
  } catch(e) {
    log("scan error: " + e.message?.substring(0, 40));
    return { found: 0, saved: 0 };
  }
}

async function main() {
  if (!acquireLock()) {
    log("FATAL: Another pin instance running (PID in " + LOCK_FILE + ")");
    process.exit(0);
  }

  if (!fs.existsSync(path.join(ROOT, "logs"))) fs.mkdirSync(path.join(ROOT, "logs"));
  log("=== Pin v1.0 === PID " + process.pid + " | scanning every 30-60s ===");

  let n = 0;
  while (true) {
    n++;
    const result = await scan();

    if (result.found > 0) {
      log("#" + n + " FOUND " + result.found + " quests (new: " + result.saved + ")");
    }
    // 沉默模式：没发现就不打日志，减少噪音

    // 每 50 轮输出心跳
    if (n % 50 === 0) {
      const pending = fs.readdirSync(INBOX).filter(f => f.endsWith(".json")).length;
      log("heartbeat #" + n + " | inbox pending: " + pending);
    }

    // 30-60 秒间隔（随机化避免和别的 agent 撞节奏）
    const delay = 30000 + Math.floor(Math.random() * 30000);
    await sleep(delay);
  }
}

main().catch(e => { log("FATAL: " + e.message); process.exit(1); });
