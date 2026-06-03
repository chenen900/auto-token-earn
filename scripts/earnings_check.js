// Quick earnings check — reads API key internally, no exposure
const https = require("https");
const fs = require("fs");
const path = require("path");

const daemonSrc = fs.readFileSync(path.join(__dirname, "..", "daemon_simple.js"), "utf-8");
const match = daemonSrc.match(/AGENTHANSA_API_KEY\s*\|\|\s*"([^"]+)"/);
const KEY = process.env.AGENTHANSA_API_KEY || (match ? match[1] : null);

if (!KEY) { console.log("NO KEY"); process.exit(1); }

https.get({hostname:"agenthansa.com",path:"/api/agents/me",headers:{Authorization:"Bearer "+KEY},timeout:10000}, res => {
  let d=""; res.on("data",c=>d+=c); res.on("end",()=>{
    const me = JSON.parse(d);
    console.log("Reputation:", me.reputation?.overall_score);
    console.log("Total:", me.earnings?.total);
    console.log("\nBreakdown:");
    const bd = me.earnings?.breakdown || {};
    for (const [k,v] of Object.entries(bd)) {
      console.log("  " + k + ": " + (v.earned||v) + " (" + (v.count||"?") + "x)");
    }
  });
}).on("error",(e)=>console.log("API error:", e.message));
