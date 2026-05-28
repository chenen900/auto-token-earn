// Quest Intelligence System — Token-powered reasoning
// Claude Code 在线时运行：拉取任务→深度分析→生成高质量响应→存入KB
// Daemon 取用 KB 预生成内容，无需实时 LLM 调用
const https = require("https");
const fs = require("fs");
const path = require("path");

const KEY = process.env.AGENTHANSA_API_KEY || "tabb_RbsUoEipzInRhm2-D2QoH5WHjyYrKJeb9Ff5TUCmx8E";
const KB = require("./knowledge_base");

function api(m, p, b) { return new Promise(r => {
  const d = b ? JSON.stringify(b) : "";
  const req = https.request({hostname:"agenthansa.com",path:p,method:m,headers:{Authorization:"Bearer "+KEY,"Content-Type":"application/json","Content-Length":d.length}}, res => {
    let o=""; res.on("data",c=>o+=c); res.on("end",()=>{ try{r(JSON.parse(o))}catch(e){r(null)} });
  }); req.on("error",()=>r(null)); if(d) req.write(d); req.end();
});}

function get(p) { return api("GET", p); }
function post(p, b) { return api("POST", p, b); }

// ====== 深度任务分析（Claude Code 手动执行时运行） ======
async function fetchQuests() {
  const inbox = await get("/api/agents/me/inbox");
  return inbox?.sections?.alliance_war_quests?.items || [];
}

async function fetchHelpRequests() {
  const feed = await get("/help/agent-feed?per_page=10");
  return feed?.requests || [];
}

// 展示任务给 Claude Code 分析
async function displayForAnalysis() {
  console.log("=== AgentHansa Quest Intelligence ===\n");

  const quests = await fetchQuests();
  console.log("ALLIANCE WAR QUESTS:", quests.length);
  for (const q of quests) {
    console.log(`\n--- Quest: ${q.id} ---`);
    console.log(`Title: ${q.title}`);
    console.log(`Reward: $${q.reward_usd}`);
    console.log(`Deadline: ${q.deadline}`);
    console.log(`Category: ${detectCategory(q.title)}`);
    console.log(`Difficulty: ${scoreDifficultyStr(q)}`);
    // Check if KB already has intel for this quest
    const existing = KB.search(q.id);
    if (existing.length > 0) {
      console.log(`KB Intel: ${existing.length} pre-generated responses available`);
    } else {
      console.log(`KB Intel: NONE — needs analysis`);
    }
  }

  const helpReqs = await fetchHelpRequests();
  console.log(`\n\nHELP REQUESTS: ${helpReqs.length}`);
  for (const r of helpReqs) {
    console.log(`\n--- Help: ${r.id} ---`);
    console.log(`Title: ${r.title}`);
    console.log(`Category: ${r.evaluation_category}`);
    console.log(`Description: ${(r.description||"").substring(0, 150)}`);
  }

  console.log("\n\n=== 请 Claude Code 分析以上任务并生成高质量响应 ===");
  console.log("对每个任务运行: node quest_intel.js respond <questId> <response>");
}

// 存储 Claude 生成的高质量响应到 KB
function storeIntel(questId, questTitle, category, response, proofUrl) {
  KB.addAtom("response_template", {
    source: `claude-intel:${questId.substring(0,12)}`,
    pattern: `预生成响应: ${questTitle.substring(0,60)}`,
    tags: ["claude-generated", category, questId],
    detail: JSON.stringify({ questId, response, proofUrl, generated: new Date().toISOString() })
  });
  console.log(`Stored intel for: ${questId.substring(0,12)}`);
}

// Daemon 调用：获取预生成响应
function getIntelForQuest(questId) {
  const atoms = KB.search(questId);
  return atoms.filter(a => a.tags?.includes("claude-generated")).slice(0, 5);
}

function detectCategory(title) {
  const t = (title||"").toLowerCase();
  const cats = ["tech","code","writing","content","translation","compliance","research","career","shopping"];
  for (const c of cats) if (t.includes(c)) return c;
  return "general";
}

function scoreDifficultyStr(q) {
  const reward = parseFloat(q.reward_usd||0);
  const title = (q.title||"").toLowerCase();
  let score = 50;
  if (title.includes("twitter")||title.includes("social")) score += 10;
  if (reward >= 100) score += 20;
  if (reward <= 20) score -= 10;
  return score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
}

// CLI
const cmd = process.argv[2] || "scan";

if (cmd === "scan") {
  displayForAnalysis().catch(console.error);
} else if (cmd === "store") {
  const [,,, questId, questTitle, category] = process.argv;
  // Read response from stdin
  let response = "";
  process.stdin.on("data", c => response += c);
  process.stdin.on("end", () => {
    storeIntel(questId, questTitle, category, response.trim(), "https://mediacraft-x402-api.onrender.com/toolbox");
  });
} else if (cmd === "get") {
  const questId = process.argv[3];
  const intel = getIntelForQuest(questId);
  if (intel.length > 0) {
    console.log(`Found ${intel.length} pre-generated responses:`);
    intel.forEach((a, i) => {
      try {
        const d = JSON.parse(a.detail);
        console.log(`\n[${i+1}] ${d.response.substring(0, 200)}...`);
      } catch(e) {}
    });
  } else {
    console.log("No pre-generated intel for this quest.");
  }
}

module.exports = { fetchQuests, storeIntel, getIntelForQuest };
