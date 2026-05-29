#!/usr/bin/env node
// mediacraft-check — One-line compliance check for AI agents
// npx mediacraft-check "文案" --platform douyin
// npx mediacraft-check --translate "你好" --from zh --to en
// npx mediacraft-check --seo "标题" --platform amazon

const https = require("https");
const fs = require("fs");
const API = process.env.MEDIACRAFT_API || "https://mediacraft-x402-api.onrender.com";

function call(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: "mediacraft-x402-api.onrender.com",
      path, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      timeout: 15000,
    }, (res) => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({ error: d.substring(0, 80) }); } });
    });
    req.on("error", (e) => resolve({ error: e.message }));
    req.write(data); req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    console.log("MediaCraft AI CLI\n  npx mediacraft-check \"text\" [--platform douyin]\n  npx mediacraft-check --file path.txt --platform amazon\n  npx mediacraft-check --translate \"你好\"\n  npx mediacraft-check --seo \"title\"");
    process.exit(0);
  }

  let text = "", platform = "douyin", mode = "compliance", from = "zh", to = "en";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--platform" && args[i + 1]) platform = args[++i];
    else if (args[i] === "--file" && args[i + 1]) text = fs.readFileSync(args[++i], "utf-8").trim();
    else if (args[i] === "--translate") { mode = "translate"; if (args[i+1] && !args[i+1].startsWith("--")) text = args[++i]; }
    else if (args[i] === "--from" && args[i + 1]) from = args[++i];
    else if (args[i] === "--to" && args[i + 1]) to = args[++i];
    else if (args[i] === "--seo") { mode = "seo"; if (args[i+1] && !args[i+1].startsWith("--")) text = args[++i]; }
    else if (!args[i].startsWith("--") && !text) text = args[i];
  }

  if (!text) { console.log("Usage: npx mediacraft-check \"content\""); process.exit(1); }

  let result;
  if (mode === "translate") result = await call("/api/v1/translate", { text, from, to });
  else if (mode === "seo") result = await call("/api/v1/seo-optimize", { title: text, platform });
  else result = await call("/api/v1/compliance-check", { text, platform, type: "script" });

  if (result.error) { console.log("Error:", result.error); process.exit(1); }

  if (mode === "compliance") {
    console.log("Score: " + result.score + "/100 — " + result.verdict);
    if (result.checks && result.checks.length > 0) {
      result.checks.forEach(c => console.log("  [" + c.severity.toUpperCase() + "] " + (c.rule || c.label) + (c.suggestion ? " → " + c.suggestion : "")));
    }
    if (result.enforcementCases && result.enforcementCases.length > 0) {
      console.log("\nPenalty cases:");
      result.enforcementCases.forEach(c => console.log("  " + c.date + " | " + c.platform + " | " + c.penalty));
    }
  } else { console.log(JSON.stringify(result, null, 2)); }
}

main().catch(e => { console.error(e.message); process.exit(1); });
