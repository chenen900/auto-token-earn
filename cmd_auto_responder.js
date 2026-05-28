// Command Auto-Responder — MediaCraft AI
// 后台自动处理常见指令，无需 Claude Code 在线
// 用法: node cmd_auto_responder.js

const https = require("https");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const API = "https://mediacraft-x402-api.onrender.com";
const TOKEN = "mediacraft-bridge-2026";
const DATA_DIR = path.join(__dirname, "data");
const PROCESSED_FILE = path.join(DATA_DIR, "processed_cmds.json");

function now() { return new Date().toLocaleTimeString(); }
function log(msg) { console.log("[" + now() + "] " + msg); }

function loadProcessed() { try { return JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf-8")); } catch(e) { return []; } }
function saveProcessed(id) { const l = loadProcessed(); l.push(id); if(l.length>200) l.splice(0,l.length-200); fs.writeFileSync(PROCESSED_FILE, JSON.stringify(l)); }

function api(method, path, body) {
  return new Promise((resolve) => {
    const url = new URL(path, API);
    const req = https.request({ hostname: url.hostname, path: url.pathname, method, headers: { "Content-Type": "application/json" } }, (res) => {
      let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Auto-handlers for common commands
const HANDLERS = {
  "查收益": async () => {
    try {
      const out = execSync("node unified_dashboard.js", { cwd: __dirname, encoding: "utf8", timeout: 10000 });
      return "[收益报告]\n" + out.substring(0, 800);
    } catch(e) { return "收益查询失败: " + e.message; }
  },
  "daemon": async () => {
    const status = await api("GET", "/daemon/status");
    if (!status) return "Daemon 状态获取失败";
    return "[Daemon 状态]\n循环: " + status.cycles + " | 运行: " + (status.running?"是":"否") +
      " | 在线: " + Math.floor(status.uptime/60) + "分钟" +
      " | 今日提交: " + status.submissionsToday + " | 今日收益: $" + status.earnedToday +
      (status.cycleHistory && status.cycleHistory.length > 0 ?
        "\n最近循环: " + JSON.stringify(status.cycleHistory.slice(-3)) : "\n尚无循环记录");
  },
};

async function processCommand(cmd) {
  const msg = cmd.message.toLowerCase().replace(/\s+/g, "");

  for (const [keyword, handler] of Object.entries(HANDLERS)) {
    if (msg.includes(keyword)) {
      log("Auto-handling: " + cmd.message.substring(0, 60));
      const response = await handler();
      const result = await api("POST", "/cmd/respond", { id: cmd.id, response, token: TOKEN });
      if (result && result.ok) {
        saveProcessed(cmd.id);
        log("  Responded OK");
      }
      return true;
    }
  }
  return false;
}

async function main() {
  log("Auto-Responder started. Handlers: " + Object.keys(HANDLERS).join(", "));

  while (true) {
    try {
      const cmds = await api("GET", "/cmd/poll");
      const processed = loadProcessed();

      if (cmds && cmds.length > 0) {
        for (const cmd of cmds) {
          if (processed.includes(cmd.id)) continue;
          if (cmd.message === "__ping__") { saveProcessed(cmd.id); continue; }

          const handled = await processCommand(cmd);
          if (!handled) {
            // Unhandled — mark as needing manual review
            log("MANUAL NEEDED: " + cmd.message.substring(0, 80));
          }
        }
      }
    } catch (e) {}

    await new Promise((r) => setTimeout(r, 5000));
  }
}

main().catch(console.error);
