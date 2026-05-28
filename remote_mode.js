// Remote Mode Controller — MediaCraft AI
// 远程模式：开启后自动处理手机发来的指令
// node remote_mode.js [on|off|status]

const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");

const FLAG = path.join(__dirname, "data", "remote_mode_on");
const PID_FILE = path.join(__dirname, "data", "remote_processor_pid");
const INBOX = path.join(__dirname, "data", "chat_inbox.json");

function isOn() { return fs.existsSync(FLAG); }

function turnOn() {
  if (isOn()) { console.log("远程模式已开启"); return; }
  fs.writeFileSync(FLAG, new Date().toISOString());
  console.log("远程模式: 开启");
  console.log("手机消息将自动处理。回复会发送到你的手机。");
}

function turnOff() {
  if (!isOn()) { console.log("远程模式未开启"); return; }
  try { fs.unlinkSync(FLAG); } catch(e) {}
  // Kill processor if running
  try { const pid = parseInt(fs.readFileSync(PID_FILE, "utf8")); process.kill(pid); } catch(e) {}
  try { fs.unlinkSync(PID_FILE); } catch(e) {}
  console.log("远程模式: 关闭");
}

// Auto-processor: runs in background, polls inbox, auto-replies
async function startProcessor() {
  if (!isOn()) return;

  console.log("远程处理器启动，每30秒检查消息...");

  const https = require("https");
  function api(method, pathStr, body) {
    return new Promise((resolve) => {
      const d = body ? JSON.stringify(body) : "";
      const opts = {
        hostname: "mediacraft-x402-api.onrender.com", path: pathStr, method,
        headers: { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(d) }
      };
      const req = https.request(opts, (res) => { let o=""; res.on("data",c=>o+=c); res.on("end",()=>{ try { resolve(JSON.parse(o)); } catch(e) { resolve(null); } }); });
      req.on("error", () => resolve(null));
      if (d) req.write(d); req.end();
    });
  }

  while (isOn()) {
    try {
      const pending = await api("GET", "/cmd/pending?token=mediacraft-bridge-2026");
      if (pending && Array.isArray(pending)) {
        for (const cmd of pending) {
          if (cmd.message === "__ping__") continue;

          // Process with claude -p (non-interactive)
          try {
            const safeMsg = cmd.message.replace(/"/g, '\\"').substring(0, 200);
            const result = execSync(`claude -p "Reply concisely in Chinese to this message from my phone: ${safeMsg}. Keep it under 100 words."`, {
              cwd: __dirname, encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024,
              stdio: ["pipe", "pipe", "pipe"]
            });

            const response = (result || "处理完成").substring(0, 500);
            await api("POST", "/cmd/respond", { id: cmd.id, response, token: "mediacraft-bridge-2026" });
            console.log(`[${new Date().toLocaleTimeString()}] Replied to: ${cmd.message.substring(0, 40)}`);
          } catch(e) {
            // claude -p not available or failed
            const fallback = `[远程自动回复] 已收到: "${cmd.message.substring(0, 40)}"\n\nClaude Code 未在本地运行，无法处理复杂请求。请稍后手动回复。`;
            await api("POST", "/cmd/respond", { id: cmd.id, response: fallback, token: "mediacraft-bridge-2026" });
          }
        }
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 30000));
  }
}

// CLI
const cmd = process.argv[2] || "status";
if (cmd === "on" || cmd === "start") {
  turnOn();
  // Start processor in background
  const child = spawn("node", [__filename, "_process"], { cwd: __dirname, detached: true, stdio: "ignore" });
  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid));
  console.log("处理器 PID:", child.pid);
} else if (cmd === "off" || cmd === "stop") {
  turnOff();
} else if (cmd === "_process") {
  startProcessor().catch(console.error);
} else {
  console.log("远程模式:", isOn() ? "开启" : "关闭");
  if (isOn()) {
    try { console.log("处理器 PID:", fs.readFileSync(PID_FILE, "utf8")); } catch(e) {}
  }
  console.log("\n用法: node remote_mode.js [on|off|status]");
}
