// API 压力测试 — MediaCraft AI
// 模拟大量并发请求，观测 Render 免费层的瓶颈
const https = require("https");

const API = "https://mediacraft-x402-api.onrender.com";
const CONCURRENT = [1, 5, 10, 20, 50]; // 逐步加压
const TEST_DATA = JSON.stringify({ text: "国家级最好的产品，100%有效，治疗痘痘", platform: "douyin", type: "title" });

function callAPI() {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.request({
      hostname: "mediacraft-x402-api.onrender.com",
      path: "/api/v1/compliance-check",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(TEST_DATA),
        "User-Agent": "MediaCraft-StressTest/1.0",
        "Accept": "application/json",
      },
      timeout: 30000,
    }, (res) => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => {
        const ms = Date.now() - start;
        try {
          const j = JSON.parse(d);
          resolve({ ok: !j.error, status: res.statusCode, ms, score: j.score });
        } catch (e) {
          resolve({ ok: false, status: res.statusCode, ms, error: d.substring(0, 50) });
        }
      });
    });
    req.on("error", (e) => resolve({ ok: false, ms: Date.now() - start, error: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, ms: Date.now() - start, error: "timeout" }); });
    req.write(TEST_DATA);
    req.end();
  });
}

async function runBatch(n) {
  const tasks = Array(n).fill(0).map(() => callAPI());
  const results = await Promise.all(tasks);

  const ok = results.filter(r => r.ok).length;
  const fails = results.filter(r => !r.ok).length;
  const times = results.map(r => r.ms);
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const max = Math.max(...times);
  const min = Math.min(...times);

  const errors = {};
  results.filter(r => !r.ok).forEach(r => {
    const key = r.error || ("HTTP " + r.status);
    errors[key] = (errors[key] || 0) + 1;
  });

  console.log(`  ${n}并发: ${ok}/${n} 成功 | avg ${avg}ms | min ${min}ms | max ${max}ms`);
  if (fails > 0) console.log(`         失败: ${JSON.stringify(errors)}`);
  return { ok, fails, avg, max };
}

async function main() {
  console.log("=== MediaCraft API 压力测试 ===\n");

  // 预热
  console.log("预热...");
  await runBatch(1);

  const summary = [];
  for (const n of CONCURRENT) {
    const r = await runBatch(n);
    summary.push({ n, successRate: ((r.ok / n) * 100).toFixed(0) + "%", avgMs: r.avg, maxMs: r.max });
    if (n > 1) await new Promise(r => setTimeout(r, 2000)); // 冷却
  }

  console.log("\n=== 汇总 ===");
  console.log("并发数 | 成功率 | 平均延迟 | 峰值延迟");
  summary.forEach(s => console.log(`  ${s.n}     | ${s.successRate}  | ${s.avgMs}ms   | ${s.maxMs}ms`));

  // 冷启动测试
  console.log("\n=== 冷启动测试（等30秒让Render休眠）===");
  console.log("等待30秒...");
  await new Promise(r => setTimeout(r, 30000));
  const cold = await runBatch(1);
  console.log(`冷启动延迟: ${cold.avg}ms`);
}

main().catch(console.error);
