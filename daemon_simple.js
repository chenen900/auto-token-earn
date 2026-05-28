// Simple Daemon — 最简版本，只做一件事：跑循环
// 不依赖任何自定义模块，纯 Node.js 内置
const https = require("https");
const API = "https://agenthansa.com/api";
const KEY = process.env.AGENTHANSA_API_KEY || "tabb_RbsUoEipzInRhm2-D2QoH5WHjyYrKJeb9Ff5TUCmx8E";

function log(msg) { console.log("[" + new Date().toISOString().substring(11, 19) + "] " + msg); }

function get(path) {
  return new Promise((resolve) => {
    https.get({ hostname: "agenthansa.com", path, headers: { Authorization: "Bearer " + KEY } }, (res) => {
      let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(null); }
      });
    }).on("error", (e) => { log("HTTP ERR: " + e.message); resolve(null); });
  });
}

function post(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname: "agenthansa.com", path, method: "POST", headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json", "Content-Length": data.length } }, (res) => {
      let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(null); }
      });
    });
    req.on("error", (e) => { log("HTTP ERR: " + e.message); resolve(null); });
    req.write(data);
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function cycle() {
  log("=== Cycle start ===");

  // 1. Checkin
  try { const r = await post("/agents/checkin"); log("Checkin: " + (r ? "OK" : "FAIL")); } catch (e) {}
  await sleep(5000);

  // 2. Account status
  try {
    const me = await get("/agents/me");
    if (me) {
      const days = Math.floor((Date.now() - new Date(me.created_at).getTime()) / 86400000);
      log("Account: " + days + "d old, Rep " + (me.reputation?.overall_score || 0) + ", $" + (me.earnings?.total || 0));
    }
  } catch (e) {}
  await sleep(5000);

  // 3. Forum comment (daily quest)
  try {
    const forum = await get("/forum?per_page=3");
    if (forum?.posts?.[0]) {
      await post("/forum/" + forum.posts[0].id + "/comments", { body: "Great analysis. This kind of detailed breakdown is really valuable for the agent ecosystem." });
      log("Forum: commented");
    }
  } catch (e) {}
  await sleep(5000);

  // 4. Quest check
  try {
    const inbox = await get("/agents/me/inbox");
    const quests = inbox?.sections?.alliance_war_quests?.items || [];
    log("Quests: " + quests.length + " available");
    if (quests.length > 0) {
      const q = quests[0];
      log("Top quest: " + (q.title || "?").substring(0, 60) + " ($" + q.reward_usd + ")");
    }
  } catch (e) {}
  await sleep(5000);

  // 5. Arena join
  try {
    const arena = await get("/arena/tournaments/upcoming");
    const items = arena?.items || arena?.tournaments || [];
    for (const t of items) {
      if (t.status === "upcoming") {
        try { await post("/arena/tournaments/" + t.id + "/participants"); log("Arena: joined"); } catch (e) {}
      }
    }
  } catch (e) {}

  log("=== Cycle done ===");
}

async function main() {
  log("Simple Daemon starting...");
  log("First cycle in 60s...");
  await sleep(60000);

  let n = 0;
  while (true) {
    n++;
    log("--- Cycle #" + n + " ---");
    try {
      await cycle();
    } catch (e) {
      log("CYCLE CRASH: " + e.message);
    }
    log("Sleeping 10min...");
    await sleep(10 * 60 * 1000);
  }
}

main().catch((e) => { log("FATAL: " + e.message); process.exit(1); });
