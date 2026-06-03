// fetch_quests.js — 从 AgentHansa API 拉取 quest 并存入管线收件箱
// 用法: node scripts/fetch_quests.js
const https = require("https");
const path = require("path");

const KEY = process.env.AGENTHANSA_API_KEY || "tabb_RbsUoEipzInRhm2-D2QoH5WHjyYrKJeb9Ff5TUCmx8E";
const qp = require("../lib/quest_pipeline");

function get(path) {
  return new Promise(r => {
    https.get({hostname:"agenthansa.com",path:path,headers:{Authorization:"Bearer "+KEY}}, res => {
      let d=""; res.on("data",c=>d+=c); res.on("end",()=>{ try { r(JSON.parse(d)); } catch(e) { r(null); } });
    }).on("error",()=>r(null));
  });
}

(async () => {
  console.log("Fetching quests from AgentHansa...");
  const inbox = await get("/agents/me/inbox");
  if (!inbox) { console.log("API unreachable"); process.exit(1); }

  const quests = inbox?.sections?.alliance_war_quests?.items || [];
  console.log("Quests found: " + quests.length);

  let saved = 0, duped = 0;
  for (const q of quests) {
    const r = qp.saveQuest(q);
    if (r.duplicate) duped++; else saved++;
    console.log("  [$" + (q.reward_usd||0) + "] " + (q.title||"").substring(0,70) + (r.duplicate ? " (dup)" : " NEW"));
  }

  console.log("\nNew: " + saved + " | Duplicates: " + duped);
  console.log("Pipeline stats: " + JSON.stringify(qp.stats()));
})();
