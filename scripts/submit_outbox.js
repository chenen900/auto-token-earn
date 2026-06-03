// Submit all ready outbox responses to AgentHansa
const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUTBOX = path.join(ROOT, "data", "quests_outbox");
const daemonSrc = fs.readFileSync(path.join(ROOT, "daemon_simple.js"), "utf-8");
const keyMatch = daemonSrc.match(/AGENTHANSA_API_KEY\s*\|\|\s*"([^"]+)"/);
const KEY = process.env.AGENTHANSA_API_KEY || (keyMatch ? keyMatch[1] : null);

if (!KEY) { console.log("NO KEY"); process.exit(1); }

function post(p, b) {
  return new Promise(r => {
    const d = JSON.stringify(b);
    const req = https.request({hostname:"agenthansa.com",path:p,method:"POST",headers:{Authorization:"Bearer "+KEY,"Content-Type":"application/json","Content-Length":d.length},timeout:10000}, res => {
      let o=""; res.on("data",c=>o+=c); res.on("end",()=>{ try { r(JSON.parse(o)); } catch(e) { r(o); } });
    }); req.on("error",e=>{console.log("ERR:",e.message); r(null);}); req.write(d); req.end();
  });
}

(async()=>{
  const files = fs.readdirSync(OUTBOX).filter(f => f.endsWith(".json"));
  console.log("Outbox files:", files.length);

  let submitted = 0;
  for (const f of files) {
    const q = JSON.parse(fs.readFileSync(path.join(OUTBOX, f), "utf-8"));
    if (q.status !== "ready" || !q.response?.content) {
      console.log("SKIP:", q.id, "(status:", q.status, ")");
      continue;
    }

    console.log("\n=== 提交:", q.id, "===");
    console.log("标题:", q.title);
    console.log("赏金: $", q.reward_usd);
    console.log("回复长度:", q.response.content.length, "chars");

    // Try multiple endpoints
    const endpoints = [
      "/api/side-quests/" + q.id + "/submit",
      "/api/quests/" + q.id + "/submit",
      "/api/engagement/" + q.id + "/submit",
    ];

    let success = false;
    for (const ep of endpoints) {
      console.log("  Trying:", ep);
      const res = await post(ep, { content: q.response.content });
      console.log("  Response:", typeof res === "string" ? res.substring(0,100) : JSON.stringify(res).substring(0,150));
      if (res && !res.error && !res.detail && !res.message && typeof res !== "string") {
        console.log("  ✅ SUCCESS via", ep);

        // Mark as submitted in outbox
        q.status = "submitted";
        q.submitted_at = new Date().toISOString();
        q.submitted_via = ep;
        fs.writeFileSync(path.join(OUTBOX, f), JSON.stringify(q, null, 2));

        // Log to bid history
        const bt = require("../lib/bid_tracker");
        bt.logBid({
          questId: q.id,
          questTitle: q.title,
          questDescription: "",
          category: "side_quest",
          reward: q.reward_usd,
          responseType: "ai_generated",
          responseSummary: q.response.content.substring(0,200),
          proofUrl: "https://x.com/binghanchen2"
        });

        submitted++;
        success = true;
        break;
      }
    }
    if (!success) console.log("  ❌ All endpoints failed for", q.id);
  }

  console.log("\n=== 完成 ===");
  console.log("提交成功:", submitted, "/", files.length);
})();
