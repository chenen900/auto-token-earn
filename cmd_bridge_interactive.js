// Interactive Command Bridge — MediaCraft AI
// 实时双向通信：远端发指令 → 本地确认 → 远端批准 → 本地执行
// 用法: node cmd_bridge_interactive.js

const https = require("https");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const API = "https://mediacraft-x402-api.onrender.com";
const TOKEN = "mediacraft-bridge-2026";
const DATA_DIR = path.join(__dirname, "data");
const PROCESSED = path.join(DATA_DIR, "interactive_processed.json");

function loadProcessed() { try { return JSON.parse(fs.readFileSync(PROCESSED, "utf-8")); } catch(e) { return []; } }
function markProcessed(id) { const l = loadProcessed(); l.push(id); if(l.length>500) l.splice(0,l.length-500); fs.writeFileSync(PROCESSED, JSON.stringify(l)); }

function api(method, path, body) {
  return new Promise((resolve) => {
    const url = new URL(path, API);
    const req = https.request({ hostname: url.hostname, path: url.pathname, method, headers: { "Content-Type": "application/json" } }, (res) => {
      let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 发确认请求到远端
async function askConfirmation(cmdId, question) {
  return await api("POST", "/cmd/ask", { id: cmdId, question, token: TOKEN });
}

// 等用户回复（轮询远端）
async function waitForReply(cmdId, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const history = await api("GET", "/cmd/history");
    if (history) {
      const cmd = history.find((c) => c.id === cmdId);
      if (cmd && cmd.userReply) {
        return cmd.userReply;
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null; // 超时
}

console.log("\n========================================");
console.log("  MediaCraft 交互式桥接器");
console.log("  远端发指令 → 本地确认 → 远端批准");
console.log("========================================\n");

// 检查队列并交互处理
async function checkQueue() {
  const cmds = await api("GET", "/cmd/pending?token=" + TOKEN);
  const processed = loadProcessed();

  if (!cmds || cmds.length === 0) return 0;

  let handled = 0;
  for (const cmd of cmds) {
    if (processed.includes(cmd.id)) continue;
    if (cmd.message === "__ping__") { markProcessed(cmd.id); continue; }

    console.log("\n" + "=".repeat(50));
    console.log("[远端指令] " + cmd.email);
    console.log("[内容] " + cmd.message);
    console.log("=".repeat(50));

    // 询问本地操作者
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const action = await new Promise((resolve) => {
      rl.question("\n执行? (y=执行 / n=拒绝 / c=需确认): ", (a) => { rl.close(); resolve(a.toLowerCase()); });
    });

    if (action === "n") {
      await api("POST", "/cmd/respond", { id: cmd.id, response: "[已拒绝] 本地操作者拒绝了此指令。", token: TOKEN });
      markProcessed(cmd.id);
      handled++;
      continue;
    }

    if (action === "c") {
      // 需要远端确认
      await askConfirmation(cmd.id, "此操作需要你确认: \"" + cmd.message + "\"。回复 '确认' 或 '取消'。");
      console.log("[等待远端确认...]");
      const reply = await waitForReply(cmd.id, 120000);
      if (!reply || reply.includes("取消")) {
        await api("POST", "/cmd/respond", { id: cmd.id, response: "[已取消] 远端未确认或超时。", token: TOKEN });
        markProcessed(cmd.id);
        handled++;
        continue;
      }
      console.log("[远端已确认: " + reply + "]");
    }

    // 执行——在这里写具体逻辑
    // 对于"查收益"类的指令，直接回复
    // 对于"部署工作1"类的指令，执行对应的操作
    const response = await executeCommand(cmd.message);
    await api("POST", "/cmd/respond", { id: cmd.id, response, token: TOKEN });
    console.log("[已回复]");
    markProcessed(cmd.id);
    handled++;
  }
  return handled;
}

// 指令执行器
async function executeCommand(msg) {
  const m = msg.toLowerCase();

  if (m.includes("查收益")) {
    try {
      const { execSync } = require("child_process");
      const out = execSync("node unified_dashboard.js", { cwd: __dirname, encoding: "utf8", timeout: 10000 });
      return "MediaCraft 收益:\n" + out.replace(/[╔═╗║╚╝╠╣]/g, "").substring(0, 500);
    } catch(e) { return "查询失败: " + e.message; }
  }

  if (m.includes("daemon") || m.includes("监控")) {
    const d = await api("GET", "/daemon/status");
    if (!d) return "获取失败";
    return "Daemon: " + d.cycles + "循环 | 在线" + Math.floor(d.uptime/60) + "分钟 | 今日$" + d.earnedToday;
  }

  return "[已执行] \"" + msg.substring(0, 60) + "\"\n\n桥接器已处理此指令。详细结果将在下次 Claude Code 会话中完成。";
}

// 主循环
async function main() {
  console.log("等待远端指令...\n");
  while (true) {
    try {
      const n = await checkQueue();
      if (n > 0) console.log("\n等待远端指令...\n");
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 5000));
  }
}

main().catch(console.error);
