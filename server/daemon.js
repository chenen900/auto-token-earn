// MediaCraft AI — Server Daemon v1
// 部署: Render Background Worker | 零依赖 | 单一进程
// 融合: Pin速度(30s嗅探) + Quest管线 + Arena策略 + 数据抓取
const https = require("https");
const fs = require("fs");
const path = require("path");

const KEY = process.env.AGENTHANSA_API_KEY;
if (!KEY) { console.error("FATAL: AGENTHANSA_API_KEY env var required"); process.exit(1); }

const DATA_DIR = path.join(__dirname, "..", "data");
const LOG_DIR = path.join(__dirname, "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "server.log");

// 确保目录存在
for (const d of [DATA_DIR, LOG_DIR,
  path.join(DATA_DIR, "quests_inbox"),
  path.join(DATA_DIR, "quests_outbox"),
  path.join(DATA_DIR, "quests_archive"),
  path.join(DATA_DIR, "arena_data"),
]) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

// ====== 日志 ======
function log(msg) { const line = "[" + new Date().toISOString().substring(11,19) + "] " + msg; console.log(line); try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch(e) {} }

// ====== HTTP ======
function get(p) {
  return new Promise(r => {
    https.get({hostname:"agenthansa.com",path:p,headers:{Authorization:"Bearer "+KEY},timeout:10000}, res => {
      let d=""; res.on("data",c=>d+=c); res.on("end",()=>{ try { r(JSON.parse(d)); } catch(e) { r(d); } });
    }).on("error",()=>r(null));
  });
}
function post(p,b) {
  return new Promise(r => {
    const d=b!==undefined?JSON.stringify(b):"{}";
    const req=https.request({hostname:"agenthansa.com",path:p,method:"POST",headers:{Authorization:"Bearer "+KEY,"Content-Type":"application/json","Content-Length":Buffer.byteLength(d)},timeout:10000}, res => {
      let o=""; res.on("data",c=>o+=c); res.on("end",()=>{ try { r(JSON.parse(o)); } catch(e) { r(o); } });
    }); req.on("error",()=>r(null)); req.write(d); req.end();
  });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ====== 数学题解析（签到 + 红包用） ======
const WORD_NUMS = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19, twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90, hundred:100 };
function solveMath(question) {
  const q = (question || "").toLowerCase();
  let nums = [];
  const arabic = q.match(/\b\d+\b/g);
  if (arabic) nums = arabic.map(Number);
  let replaced = q;
  for (const [word, val] of Object.entries(WORD_NUMS)) {
    if (replaced.includes(word)) { nums.push(val); replaced = replaced.replace(new RegExp(word,"g"), String(val)); }
  }
  const ordered = replaced.match(/\b\d+\b/g);
  if (ordered) nums = ordered.map(Number);
  if (nums.length < 2) return null;
  const a = nums[0], b = nums[1] || 0, c = nums[2] || 0;
  let answer;
  if (q.includes("from") && q.includes("inclusive")) answer = b - a + 1;
  else if (q.includes("doubles") && (q.includes("finds")||q.includes("adds")||q.includes("gets"))) answer = a * 2 + b;
  else if (q.includes("doubles")) answer = a * 2;
  else if (q.includes("triples")) answer = a * 3;
  else if (q.includes("halves")||q.includes("half")) answer = Math.floor(a / 2);
  else if (q.includes("multiplied by") && (q.includes("minus")||q.includes("subtract"))) answer = a * b - c;
  else if (q.includes("multiplied by") && q.includes("plus")) answer = a * b + c;
  else if (q.includes("multiplied by") || q.includes("times")) answer = a * b;
  else if (q.includes("divided by")) answer = Math.floor(a / b);
  else if (q.includes("loses")||q.includes("lose")) answer = a - b;
  else if (q.includes("minus") || q.includes("subtract")) answer = a - b;
  else if (q.includes("finds")||q.includes("gains")||q.includes("gets")) answer = a + b;
  else answer = a + b;
  return { answer, calc: nums.join("→") };
}

// ====== 安全审查 ======
const SAFE_KW = ["xi jinping", "tiananmen", "tibet independence", "xinjiang", "taiwan independence", "falun gong", "china virus", "porn", "violence", "drug", "gambling"];
function safetyCheck(t) { const l = (t||"").toLowerCase(); for (const k of SAFE_KW) if (l.includes(k)) return false; return true; }

// ====== 签到（每天一次） ======
let lastCheckin = 0;
async function doCheckin() {
  if (Date.now() - lastCheckin < 5.5 * 3600 * 1000) return; // 6小时冷却
  try {
    const ci = await post("/agents/checkin");
    if (ci?.challenge_id) {
      const solved = solveMath(ci.question);
      if (solved) {
        const cr = await post("/agents/checkin/verify", { challenge_id: ci.challenge_id, challenge_answer: solved.answer });
        if (cr) { lastCheckin = Date.now(); log("CHECKIN: OK — " + (ci.question||"").substring(0,40)); }
      }
    }
  } catch(e) {}
}

// ====== Arena 引擎 ======
const { computeMove, saveRoundData, saveTournamentResult } = (() => {
  try { return require("./arena_engine"); } catch(e) { return { computeMove: ()=>5, saveRoundData: ()=>{}, saveTournamentResult: ()=>{} }; }
})();
const { scrapeAll } = (() => {
  try { return require("./scraper"); } catch(e) { return { scrapeAll: async ()=>null }; }
})();

const ARENA_DATA = path.join(DATA_DIR, "arena_data");
async function processArena() {
  try {
    const arena = await get("/api/arena/tournaments/upcoming");
    if (!arena?.id) return;

    // 🔍 爬虫双保险：独立抓取原始数据
    try { await scrapeAll(); } catch(e) {}

    const t = arena;
    // 抓取数据（无论什么状态都记录）
    const snapshot = {
      time: new Date().toISOString(),
      id: t.id,
      status: t.status || t.phase,
      game: t.game?.display_name,
      pot: t.pot_amount,
      participants: t.participant_count,
      current_round: t.current_round,
      rounds_per_match: t.rounds_per_match,
      winner: t.winner,
      placements: t.placements || [],
    };
    const snapFile = path.join(ARENA_DATA, "snapshot_" + t.id + ".json");
    fs.writeFileSync(snapFile, JSON.stringify(snapshot, null, 2));

    // 加入 upcoming 比赛
    if (t.status === "upcoming" && t.phase === "queue") {
      try { await post("/api/arena/tournaments/"+t.id+"/join"); log("ARENA: joined " + t.id.substring(0,8)); } catch(e) {}
    }

    // 参加 live 比赛
    if (t.status === "live") {
      try {
        const pair = await get("/api/arena/tournaments/"+t.id+"/my-pairing");
        if (pair?.round_number && !pair.submitted) {
          // 保存轮次原始数据
          saveRoundData(t.id, pair.round_number, { pairing: pair, tournament: t });

          // 策略计算
          const { move, reasoning } = computeMove(pair, t);
          await post("/api/arena/tournaments/"+t.id+"/rounds/"+pair.round_number+"/submit", { move: move });
          log("ARENA: r" + pair.round_number + " move=" + move + " [" + reasoning + "] — " + t.id.substring(0,8));
        }
      } catch(e) {}
    }

    // 比赛结束后抓完整的 placements
    if (t.status === "settled" && t.winner) {
      log("ARENA: settled — winner=" + t.winner + " pot=$" + t.pot_amount);
    }
  } catch(e) {}
}

// ====== Quest 管线 ======
const INBOX = path.join(DATA_DIR, "quests_inbox");
const OUTBOX = path.join(DATA_DIR, "quests_outbox");
const SIGNAL = path.join(DATA_DIR, ".new_quests_signal");

function saveToInbox(q) {
  const file = path.join(INBOX, (q.id || "q_"+Date.now()) + ".json");
  if (fs.existsSync(file)) return false;
  const record = {
    id: q.id, title: q.title || "", description: q.description || "",
    reward_usd: parseFloat(q.reward_usd||0), _section: q._section,
    pinned_at: new Date().toISOString(), raw: q
  };
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  try { fs.writeFileSync(SIGNAL, JSON.stringify({ time: new Date().toISOString(), count: 1 })); } catch(e) {}
  return true;
}

function getOutboxResponses() {
  if (!fs.existsSync(OUTBOX)) return {};
  const map = {};
  for (const f of fs.readdirSync(OUTBOX).filter(f => f.endsWith(".json"))) {
    try {
      const q = JSON.parse(fs.readFileSync(path.join(OUTBOX, f), "utf-8"));
      if (q.status === "ready" && q.response) map[q.id] = q.response;
    } catch(e) {}
  }
  return map;
}

async function scanQuests() {
  try {
    const inbox = await get("/api/agents/me/inbox");
    if (!inbox?.sections) return { found: 0, saved: 0 };

    let found = 0, saved = 0;
    const sources = ["alliance_war_quests", "side_quests", "engagement", "personal"];
    for (const key of sources) {
      const items = inbox.sections[key]?.items || [];
      for (const q of items) { found++; q._section = key; if (saveToInbox(q)) saved++; }
    }
    return { found, saved };
  } catch(e) { return { found: 0, saved: 0 }; }
}

async function submitResponses(aiResponseMap) {
  const quests = [];
  // 从 inbox 收集所有 quest
  if (fs.existsSync(INBOX)) {
    for (const f of fs.readdirSync(INBOX).filter(f => f.endsWith(".json"))) {
      try { quests.push(JSON.parse(fs.readFileSync(path.join(INBOX, f), "utf-8"))); } catch(e) {}
    }
  }

  let submitted = 0;
  for (const q of quests) {
    const aiResp = aiResponseMap[q.id];
    if (!aiResp?.content) continue;

    // side quest 提交
    if (q._section === "side_quests" || q._section === "engagement") {
      try {
        const res = await post("/api/side-quests/submit", { quest_id: q.id, responses: buildSideQuestFields(q.id, aiResp.content) });
        if (res?.completed) { submitted++; log("SUBMIT: side " + q.id); }
      } catch(e) {}
    }

    // alliance war 提交
    if (q._section === "alliance_war") {
      try {
        const feed = await get("/help/agent-feed?per_page=3");
        const reqs = feed?.requests || [];
        if (reqs.length > 0) {
          const resp = await post("/help/requests/"+reqs[0].id+"/respond", { content: aiResp.content });
          if (resp?.id) {
            await post("/alliance-war/quests/"+q.id+"/submit", { content: resp.id, proof_url: "https://x.com/binghanchen2" });
            submitted++; log("SUBMIT: aw " + q.id);
          }
        }
      } catch(e) {}
    }
    await sleep(2000);
  }
  return submitted;
}

function buildSideQuestFields(questId, content) {
  const maps = {
    "identify-infrastructure": { agent_type: content },
    "first-impression": { what_you_like: content },
    "share-your-stack": { hosting: content },
  };
  return maps[questId] || { content };
}

// ====== HTTP 服务（健康检查 + 总控台） ======
function startHealthServer() {
  const PORT = process.env.PORT || 8080;
  try {
    require("http").createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, {"Content-Type":"application/json"});
        res.end(JSON.stringify({ status:"ok", pid:process.pid, uptime:process.uptime() }));
      } else if (req.url === "/" || req.url === "/dashboard") {
        // 服务总控台页面
        const dashPath = path.join(__dirname, "dashboard.html");
        if (fs.existsSync(dashPath)) {
          res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"});
          res.end(fs.readFileSync(dashPath, "utf-8"));
        } else {
          res.writeHead(200, {"Content-Type":"text/plain"});
          res.end("MediaCraft AI Server — dashboard.html not found");
        }
      } else {
        res.writeHead(200, {"Content-Type":"text/plain"});
        res.end("MediaCraft AI Server — running");
      }
    }).listen(PORT, () => log("HTTP: listening on :" + PORT + " (dashboard at /)"));
  } catch(e) { log("HTTP: server failed (worker mode, ignoring)"); }
}

// ====== 每日自动更新总控台（UTC 14:00 = 北京时间 22:00） ======
function updateDashboard() {
  try {
    const dashPath = path.join(__dirname, "dashboard.html");
    if (!fs.existsSync(dashPath)) return;
    let html = fs.readFileSync(dashPath, "utf-8");
    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);
    const timeStr = now.toTimeString().substring(0, 5);

    // 从状态文件读取最新数据
    let earnings = "$0.40";
    try {
      const statusFile = path.join(DATA_DIR, "server_status.json");
      if (fs.existsSync(statusFile)) {
        const status = JSON.parse(fs.readFileSync(statusFile, "utf-8"));
        if (status.earnings) earnings = status.earnings;
      }
    } catch(e) {}

    html = html.replace(/<div class="money">\$[\d.]+<\/div>/, '<div class="money">' + earnings + '</div>');
    html = html.replace(/<div style="margin-top:3px;color:#3fb950">[^<]*<\/div>/, '<div style="margin-top:3px;color:#3fb950">24/7 Server · auto-updated daily</div>');
    html = html.replace(/更新: [^·]+ · [^<]*/, '更新: ' + dateStr + ' ' + timeStr + ' · 24/7 Server · 累计' + earnings);
    fs.writeFileSync(dashPath, html);
    log("DASHBOARD: auto-updated (" + earnings + ")");
  } catch(e) { log("DASHBOARD-ERR: " + e.message?.substring(0,40)); }
}

// ====== 主循环 ======
async function main() {
  log("=== Server Daemon v1.0 === PID " + process.pid + " ===");
  log("Mode: pin-speed scan(30-60s) + quest pipeline + arena + checkin");

  // 启动健康检查
  startHealthServer();

  let n = 0;
  while (true) {
    n++;

    // 1. 快速 quest 扫描（pin 速度）
    const qr = await scanQuests();
    if (qr.found > 0) log("#" + n + " QUESTS: found=" + qr.found + " new=" + qr.saved);

    // 2. 提交已有的 AI 回复
    const outbox = getOutboxResponses();
    if (Object.keys(outbox).length > 0) {
      const sub = await submitResponses(outbox);
      if (sub > 0) log("#" + n + " SUBMIT: " + sub + " responses sent");
    }

    // 3. Arena（每 5 轮检查一次，arena 是 2h 节奏，不需要 30s 查）
    if (n % 5 === 0) await processArena();

    // 4. 签到（每 6h，自动跳过）
    if (n % 20 === 0) await doCheckin();

    // 5. 数据采集心跳（每 50 轮写一次状态）
    if (n % 50 === 0) {
      try {
        const me = await get("/api/agents/me");
        const statusFile = path.join(DATA_DIR, "server_status.json");
        fs.writeFileSync(statusFile, JSON.stringify({
          time: new Date().toISOString(), cycle: n,
          reputation: me?.reputation?.overall_score,
          earnings: me?.earnings?.total,
          inbox_files: fs.readdirSync(INBOX).filter(f=>f.endsWith(".json")).length,
          outbox_files: fs.existsSync(OUTBOX) ? fs.readdirSync(OUTBOX).filter(f=>f.endsWith(".json")).length : 0,
        }, null, 2));
      } catch(e) {}

      // 每日更新总控台（UTC 14:00-14:30 之间）
      const now = new Date();
      if (now.getUTCHours() === 14 && now.getUTCMinutes() < 30) {
        try { updateDashboard(); } catch(e) {}
      }
    }

    // 6. 主循环间隔：30-60s（pin 速度）
    const delay = 30000 + Math.floor(Math.random() * 30000);
    await sleep(delay);
  }
}

main().catch(e => { log("FATAL: " + e.message); process.exit(1); });
