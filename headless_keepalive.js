// headless_keepalive.js — 无头版 Render 防休眠
// 无需浏览器，Node.js 后台运行。每 5 分钟 ping 一次。
// 用法: node headless_keepalive.js
// 后台运行: start /B node headless_keepalive.js

const https = require("https");
const URL = "https://mediacraft-x402-api.onrender.com/daemon/health";
const INTERVAL_MS = 5 * 60 * 1000; // 5 分钟

let count = 0;

function ping() {
  count++;
  const start = Date.now();
  https.get(URL, { timeout: 10000 }, (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => {
      const ms = Date.now() - start;
      const ts = new Date().toLocaleTimeString("zh-CN");
      console.log(`[${ts}] #${count} OK (${ms}ms) — ${data.substring(0, 80)}`);
    });
  }).on("error", (e) => {
    const ts = new Date().toLocaleTimeString("zh-CN");
    console.log(`[${ts}] #${count} FAIL: ${e.message}`);
  });
}

console.log("=== MediaCraft Headless Keepalive ===");
console.log(`Target: ${URL}`);
console.log(`Interval: ${INTERVAL_MS / 60000} min`);
console.log("Keep this window open. Press Ctrl+C to stop.");
console.log("");

ping();
setInterval(ping, INTERVAL_MS);
