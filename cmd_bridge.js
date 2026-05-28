// Command Bridge — MediaCraft AI
// 连接 Render 指挥台和本地 Claude Code
// 用法: node cmd_bridge.js

const https = require("https");
const fs = require("fs");
const path = require("path");

const API = "https://mediacraft-x402-api.onrender.com";
const TOKEN = "mediacraft-bridge-2026";
const POLL_MS = 5000;

const LOG_DIR = path.join(__dirname, "logs");
const PROCESSED_FILE = path.join(__dirname, "data", "processed_cmds.json");

function now() { return new Date().toISOString().replace("T", " ").substring(0, 19); }
function log(msg) { console.log("[" + now() + "] " + msg); }

function loadProcessed() {
  try { return JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf-8")); } catch(e) { return []; }
}
function saveProcessed(id) {
  const list = loadProcessed();
  list.push(id);
  if (list.length > 200) list.splice(0, list.length - 200);
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(list));
}

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method,
      headers: { "Content-Type": "application/json" },
    };
    const req = https.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(null); }
      });
    });
    req.on("error", (e) => resolve(null));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function pollCommands() {
  const cmds = await api("GET", "/cmd/poll");
  if (!cmds || cmds.length === 0) return null;

  const processed = loadProcessed();
  for (const cmd of cmds) {
    if (processed.includes(cmd.id)) continue;

    if (cmd.message === "__ping__") {
      saveProcessed(cmd.id);
      continue;
    }

    // New command found! Display and wait for response
    console.log("\n" + "=".repeat(60));
    console.log("[NEW COMMAND] " + cmd.email);
    console.log("[TIME] " + cmd.createdAt);
    console.log("[MESSAGE] " + cmd.message);
    console.log("=".repeat(60));
    console.log("\nType your response (end with empty line):");

    // Read multi-line response from stdin
    const lines = [];
    const readline = require("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const response = await new Promise((resolve) => {
      rl.on("line", (line) => {
        if (line === "" || line === ".") { rl.close(); resolve(lines.join("\n")); }
        else lines.push(line);
      });
      rl.prompt();
    });

    if (response.trim()) {
      const result = await api("POST", "/cmd/respond", { id: cmd.id, response, token: TOKEN });
      if (result && result.ok) {
        console.log("[OK] Response sent for " + cmd.id);
      } else {
        console.log("[FAIL] Response failed: " + JSON.stringify(result));
      }
    }
    saveProcessed(cmd.id);
    return true;
  }
  return false;
}

async function main() {
  console.log("MediaCraft Command Bridge");
  console.log("Polling " + API + "/cmd/poll every " + POLL_MS / 1000 + "s");
  console.log("Waiting for commands...\n");

  while (true) {
    try {
      await pollCommands();
    } catch (e) {
      // silent
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch(console.error);
