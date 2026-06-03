// Arena Data Scraper — 独立数据爬虫（双保险）
// 不管引擎做出什么决策，这里忠实记录每场比赛的完整数据
// 输出: data/arena_data/scrape_*.json (按时间戳)
const https = require("https");
const fs = require("fs");
const path = require("path");

const KEY = process.env.AGENTHANSA_API_KEY;
if (!KEY) { console.error("FATAL: AGENTHANSA_API_KEY env var required"); process.exit(1); }

const DATA_DIR = path.join(__dirname, "..", "data", "arena_data");
const SCRAPE_LOG = path.join(DATA_DIR, "scrape_log.jsonl");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function get(p) {
  return new Promise(r => {
    https.get({hostname:"agenthansa.com",path:p,headers:{Authorization:"Bearer "+KEY},timeout:10000}, res => {
      let d=""; res.on("data",c=>d+=c); res.on("end",()=>{ try { r(JSON.parse(d)); } catch(e) { r(d); } });
    }).on("error",()=>r(null));
  });
}

// 记录一条抓取日志
function logScrape(type, data) {
  const record = { type, time: new Date().toISOString(), data };
  fs.appendFileSync(SCRAPE_LOG, JSON.stringify(record) + "\n");
}

// 全量抓取：upcoming + live tournaments
async function scrapeAll() {
  const timestamp = Date.now();
  const snapshot = { time: new Date().toISOString(), upcoming: null, live: null, myPairing: null };

  // 1. 抓 upcoming/live tournament
  const upcoming = await get("/api/arena/tournaments/upcoming");
  snapshot.upcoming = upcoming;
  logScrape("upcoming", upcoming);

  // 2. 如果 live，抓我的配对数据
  if (upcoming?.status === "live" && upcoming?.id) {
    const pair = await get("/api/arena/tournaments/" + upcoming.id + "/my-pairing");
    snapshot.myPairing = pair;
    logScrape("pairing", { tournamentId: upcoming.id, pairing: pair });
  }

  // 3. 如果 settled，抓 placements
  if (upcoming?.status === "settled" && upcoming?.id) {
    snapshot.placements = upcoming.placements;
    logScrape("settled", { tournamentId: upcoming.id, winner: upcoming.winner, pot: upcoming.pot_amount });
  }

  // 4. 写到时间戳快照文件
  const file = path.join(DATA_DIR, "scrape_" + timestamp + ".json");
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));

  return snapshot;
}

// 对比引擎数据 vs 爬虫数据，检查一致性
function verifyConsistency() {
  const issues = [];
  const files = fs.readdirSync(DATA_DIR);

  const engineRounds = files.filter(f => f.startsWith("round_"));
  const scrapeFiles = files.filter(f => f.startsWith("scrape_"));

  for (const rf of engineRounds) {
    const hasCorresponding = scrapeFiles.some(sf => {
      const rTime = rf.match(/_r(\d+)/)?.[1];
      return rTime && sf.includes(rTime);
    });
    if (!hasCorresponding) {
      issues.push("引擎记录了 " + rf + " 但爬虫没有对应快照");
    }
  }

  return {
    engineDecisions: engineRounds.length,
    scraperSnapshots: scrapeFiles.length,
    issues,
    verdict: issues.length === 0 ? "数据一致 ✅" : "数据不一致，需要排查"
  };
}

// ====== CLI ======
if (require.main === module) {
  const cmd = process.argv[2] || "scrape";

  (async () => {
    if (cmd === "scrape") {
      console.log("抓取中...");
      const snap = await scrapeAll();
      console.log("Upcoming:", snap.upcoming?.status, "| Game:", snap.upcoming?.game?.display_name);
      console.log("Participants:", snap.upcoming?.participant_count, "| Pot:", snap.upcoming?.pot_amount);
      if (snap.myPairing) console.log("My pairing:", JSON.stringify(snap.myPairing).substring(0, 200));
      console.log("Saved.");
    } else if (cmd === "verify") {
      console.log(JSON.stringify(verifyConsistency(), null, 2));
    } else if (cmd === "stats") {
      const files = fs.readdirSync(DATA_DIR);
      console.log("Scrape snapshots:", files.filter(f => f.startsWith("scrape_")).length);
      console.log("Engine rounds:", files.filter(f => f.startsWith("round_")).length);
      console.log("Results:", files.filter(f => f.startsWith("result_")).length);
      console.log("Decision log entries:", fs.existsSync(path.join(DATA_DIR, "decision_log.jsonl"))
        ? fs.readFileSync(path.join(DATA_DIR, "decision_log.jsonl"), "utf-8").trim().split("\n").length
        : 0);
    } else {
      console.log("Usage: node server/scraper.js [scrape|verify|stats]");
    }
  })();
}

module.exports = { scrapeAll, verifyConsistency };
