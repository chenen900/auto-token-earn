// Standalone Remote Processor — zero Claude Code involvement
// 轮询手机消息 → 自动回复。不需要任何权限确认。
const https = require("https");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const API = "https://mediacraft-x402-api.onrender.com";
const TOKEN = "mediacraft-bridge-2026";
const PROCESSED = path.join(__dirname, "data", "remote_processed.json");

function load() { try { return JSON.parse(fs.readFileSync(PROCESSED,"utf8")); } catch(e) { return []; } }
function save(id) { const l=load(); l.push(id); if(l.length>500) l.splice(0,l.length-500); fs.writeFileSync(PROCESSED,JSON.stringify(l)); }
function now() { return new Date().toLocaleTimeString(); }

function api(method, pathStr, body) {
  return new Promise((resolve) => {
    const url = new URL(pathStr, API);
    const d = body ? JSON.stringify(body) : "";
    const req = https.request({ hostname: url.hostname, path: url.pathname, method, headers: { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(d) } }, (res) => {
      let o = ""; res.on("data", c => o += c); res.on("end", () => { try { resolve(JSON.parse(o)); } catch(e) { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    if (d) req.write(d); req.end();
  });
}

async function reply(id, text) {
  return await api("POST", "/cmd/respond", { id, response: text, token: TOKEN });
}

async function askQuestion(id, question) {
  return await api("POST", "/cmd/ask", { id, question, token: TOKEN });
}

// 智能回复引擎
async function processMessage(cmd) {
  const msg = (cmd.message || "").toLowerCase();

  // 查收益
  if (/收益|赚了|余额|earn/.test(msg)) {
    try {
      const out = execSync("node unified_dashboard.js", { cwd: __dirname, encoding: "utf8", timeout: 8000 });
      return "收益报告:\n" + out.replace(/[╔═╗║╚╝╠╣]/g, "-").substring(0, 400);
    } catch(e) { return "查询失败: " + e.message; }
  }

  // Daemon 状态
  if (/daemon|监控|循环|状态/.test(msg)) {
    const d = await api("GET", "/daemon/status");
    if (!d) return "Daemon 状态获取失败";
    return "Daemon: " + d.cycles + "轮 | 在线" + Math.floor(d.uptime/60) + "分钟 | " + (d.running?"运行中":"空闲") + "\n今日: " + d.submissionsToday + "提交 | $" + d.earnedToday;
  }

  // 工作进度
  if (/工作.*[a-f]|进度|todo/.test(msg)) {
    return "工作A: Agent赚钱 — daemon v3运行中\n工作B: 工具箱 — 9功能上线\n工作C: API挂牌 — x402自动发现\n工作D: Agent贩卖 — 待启动\n工作E: 舆论战 — 待定义\n工作F: 基础设施 — 90%完成";
  }

  // DeFi
  if (/defi|模拟/.test(msg)) {
    try {
      const out = execSync("node defi_simulator.js report", { cwd: __dirname, encoding: "utf8", timeout: 8000 });
      return "DeFi模拟:\n" + out.substring(0, 400);
    } catch(e) { return "DeFi查询失败"; }
  }

  // 部署/推送
  if (/部署|推送|push/.test(msg)) {
    // 需要确认 — 发问题到手机
    await askQuestion(cmd.id, "确认部署代码到 GitHub？回复 '确认' 或 '取消'。");
    return null; // 等待用户确认
  }

  // 默认
  return "[自动回复] 收到: \"" + cmd.message.substring(0, 50) + "\"\n\n可用指令: 查收益 | daemon | 工作进度 | defi\n\n复杂问题请等 Claude Code 在线处理。";
}

async function checkAndProcess() {
  try {
    const pending = await api("GET", "/cmd/pending?token=" + TOKEN);
    const processed = load();
    if (!pending || !Array.isArray(pending)) return;

    for (const cmd of pending) {
      if (processed.includes(cmd.id)) continue;
      if (cmd.message === "__ping__") { save(cmd.id); continue; }

      if (cmd.userReply) {
        if (cmd.userReply.includes("确认") || cmd.userReply.toLowerCase().includes("yes")) {
          try {
            execSync("git add -A && git commit -m '[remote] auto-deploy' && git push", { cwd: __dirname, encoding: "utf8", timeout: 15000 });
            await reply(cmd.id, "Done. Code pushed to GitHub.");
          } catch(e) {
            await reply(cmd.id, "Deploy failed: " + e.message.substring(0, 100));
          }
        } else { await reply(cmd.id, "Cancelled."); }
        save(cmd.id);
        continue;
      }

      console.log("[" + now() + "] " + cmd.message.substring(0, 50));
      const response = await processMessage(cmd);
      if (response) { await reply(cmd.id, response); save(cmd.id); console.log("[" + now() + "] replied"); }
    }
  } catch(e) {}
}

async function main() {
  console.log("[" + now() + "] Remote processor started — no permissions needed");

  // 第一分钟：每10秒检查
  console.log("Fast polling: every 10s for first minute");
  for (let i = 0; i < 6; i++) {
    await checkAndProcess();
    await new Promise(r => setTimeout(r, 10000));
  }

  // 之后：每30秒
  console.log("Normal polling: every 30s");
  while (true) {
    await checkAndProcess();
    await new Promise(r => setTimeout(r, 30000));
  }
}

main().catch(console.error);
