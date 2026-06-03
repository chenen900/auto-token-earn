// Quick quest check — reads key from daemon, no hardcode in this file
const https = require("https");
const fs = require("fs");
const path = require("path");

// Read key from daemon source
const daemonSrc = fs.readFileSync(path.join(__dirname, "..", "daemon_simple.js"), "utf-8");
const keyMatch = daemonSrc.match(/AGENTHANSA_API_KEY\s*\|\|\s*"([^"]+)"/);
const KEY = process.env.AGENTHANSA_API_KEY || (keyMatch ? keyMatch[1] : null);

if (!KEY) { console.log("NO KEY FOUND"); process.exit(1); }

function get(p) {
  return new Promise(r => {
    https.get({hostname:"agenthansa.com",path:p,headers:{Authorization:"Bearer "+KEY},timeout:10000}, res => {
      let d=""; res.on("data",c=>d+=c); res.on("end",()=>{ try { r(JSON.parse(d)); } catch(e) { r(d); } });
    }).on("error",()=>r(null));
  });
}

(async()=>{
  const inbox = await get("/api/agents/me/inbox");
  if (!inbox || typeof inbox === "string") { console.log("API ERROR:", typeof inbox); process.exit(1); }

  const sections = inbox.sections || {};
  const aw = sections.alliance_war_quests?.items || [];
  const side = sections.side_quests?.items || [];
  const eng = sections.engagement?.items || [];
  const personal = sections.personal?.items || [];

  console.log("=== AgentHansa Quest 检查 ===");
  console.log("时间:", new Date().toISOString());
  console.log("alliance_war:", aw.length);
  console.log("side_quests:", side.length);
  console.log("engagement:", eng.length);
  console.log("personal:", personal.length);
  console.log("总计:", aw.length + side.length + eng.length + personal.length);

  const all = [...aw, ...side, ...eng, ...personal];
  if (all.length === 0) {
    console.log("\n当前平台无可用任务。");
  } else {
    console.log("\n任务列表:");
    for (const q of all) {
      console.log(`  [$${q.reward_usd||0}] ${(q.title||"").substring(0,80)}`);
      console.log(`    ID: ${q.id} | 类型: ${q.action_type||q.evaluation_category||"?"}`);
    }
  }
})();
