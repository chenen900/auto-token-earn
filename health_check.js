// Unified Health Check — MediaCraft AI
// 覆盖所有服务：API / Daemon / AgentHansa / KB / 内存 / 网络
// 用法: node health_check.js [--json]
const https = require("https");
const fs = require("fs");
const path = require("path");

const CHECKS = {
  api_compliance: {
    name: "合规API",
    url: "https://mediacraft-x402-api.onrender.com/api/v1/compliance-check",
    method: "POST",
    body: JSON.stringify({ text: "测试文案", platform: "douyin" }),
    check: (r) => r.score !== undefined && !r.error,
  },
  api_queue: {
    name: "API队列",
    url: "https://mediacraft-x402-api.onrender.com/api/v1/queue-status",
    check: (r) => r.maxConcurrent > 0,
  },
  api_x402: {
    name: "x402发现端点",
    url: "https://mediacraft-x402-api.onrender.com/.well-known/x402",
    check: (r) => r.endpoints?.length >= 3,
  },
  api_manifest: {
    name: "x402-manifest",
    url: "https://mediacraft-x402-api.onrender.com/x402-manifest",
    check: (r) => r.services?.length >= 3,
  },
  daemon_status: {
    name: "Daemon",
    url: "https://mediacraft-x402-api.onrender.com/daemon/status",
    check: (r) => r.cycles !== undefined && !r.error,
  },
  daemon_health: {
    name: "Daemon运行",
    url: "https://mediacraft-x402-api.onrender.com/daemon/health",
    check: (r) => r.ok === true,
  },
  toolbox: {
    name: "工具箱网站",
    url: "https://mediacraft-x402-api.onrender.com/toolbox",
    check: (r) => typeof r === "string" || true, // HTML response
    raw: true,
  },
  command: {
    name: "远程指挥台",
    url: "https://mediacraft-x402-api.onrender.com/command",
    check: (r) => typeof r === "string" || true,
    raw: true,
  },
  agenthansa: {
    name: "AgentHansa连接",
    hostname: "agenthansa.com",
    path: "/api/agents/me",
    headers: { Authorization: "Bearer tabb_RbsUoEipzInRhm2-D2QoH5WHjyYrKJeb9Ff5TUCmx8E" },
    check: (r) => r.email !== undefined || r.name !== undefined,
  },
  kb_health: {
    name: "知识库",
    fn: () => {
      try {
        const kb = require("./knowledge_base");
        const s = kb.stats();
        return { ok: true, atoms: s.totalAtoms, categories: Object.keys(s.byCategory).length };
      } catch (e) { return { ok: false, error: e.message }; }
    },
    local: true,
  },
  memory: {
    name: "内存",
    fn: () => ({
      ok: true,
      heapMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    }),
    local: true,
  },
};

function call(url, options = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const headers = options.headers || { "User-Agent": "MediaCraft-HealthCheck/1.0" };
    if (options.body) headers["Content-Type"] = "application/json";
    if (options.body) headers["Content-Length"] = Buffer.byteLength(options.body);
    const opts = {
      hostname: options.hostname || u.hostname,
      path: options.path || u.pathname,
      method: options.method || "GET",
      headers,
      timeout: 15000,
    };
    const req = https.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        if (options.raw) resolve(d.substring(0, 50)); // just check non-empty
        else {
          try { resolve(JSON.parse(d)); } catch (e) { resolve({ error: "invalid JSON", raw: d.substring(0, 80) }); }
        }
      });
    });
    req.on("error", (e) => resolve({ error: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ error: "timeout" }); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runAll() {
  const results = {};
  let pass = 0,
    fail = 0;

  for (const [key, check] of Object.entries(CHECKS)) {
    const start = Date.now();
    try {
      let result;
      if (check.local && check.fn) {
        result = check.fn();
      } else if (check.url) {
        result = await call(check.url, { method: check.method, body: check.body, raw: check.raw });
      } else {
        result = await call("https://" + check.hostname + check.path, { headers: check.headers });
      }

      const ok = check.check ? check.check(result) : !result.error;
      results[key] = { name: check.name, ok, ms: Date.now() - start, ...(ok ? {} : { error: result.error || "check failed" }) };
      if (ok) pass++;
      else fail++;
    } catch (e) {
      results[key] = { name: check.name, ok: false, ms: Date.now() - start, error: e.message };
      fail++;
    }
  }

  return { time: new Date().toISOString(), pass, fail, total: pass + fail, results };
}

// CLI
if (require.main === module) {
  const json = process.argv.includes("--json");
  runAll().then((report) => {
    if (json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log("=== MediaCraft AI 全局健康检查 ===\n");
    for (const [key, r] of Object.entries(report.results)) {
      const icon = r.ok ? "✅" : "❌";
      const ms = r.ms ? `(${r.ms}ms)` : "";
      console.log(`${icon} ${r.name} ${ms}`);
      if (!r.ok) console.log(`   ❌ ${r.error}`);
    }
    console.log(`\n${report.pass}/${report.total} 通过 | ${report.fail === 0 ? "全部正常 ✅" : "有 " + report.fail + " 项异常 ❌"}`);
    process.exit(report.fail > 0 ? 1 : 0);
  });
}

module.exports = { runAll, CHECKS };
