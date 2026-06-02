// 本地高质量投标引擎 — MediaCraft AI
// 拉取任务 → 保存供 AI 分析 → 提交定制化回复
// 用法: node local_quality_bidder.js [fetch|submit|status]

const fs = require("fs");
const path = require("path");
const https = require("https");

// .env 加载
try {
  const envFile = fs.readFileSync(path.join(__dirname, ".env"), "utf-8");
  envFile.split("\n").forEach(line => {
    const m = line.match(/^\s*(\w[\w_]*)\s*=\s*(.+)/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
} catch(e) {}

const AH_KEY = process.env.AGENTHANSA_API_KEY || "tabb_RbsUoEipzInRhm2-D2QoH5WHjyYrKJeb9Ff5TUCmx8E";
const PINK_KEY = process.env.PINCHWORK_API_KEY || "pwk-eBW8EqbaVxulc9NYQxkh0dk-Mmhk7p-VxreIcEcmy7M";
const ST_KEY = process.env.SUPERTEAM_API_KEY || "";
const TOKU_KEY = process.env.TOKU_API_KEY || "";
const DATA_DIR = path.join(__dirname, "data");
const TASKS_FILE = path.join(DATA_DIR, "pending_tasks.json");
const SUBMITTED_FILE = path.join(DATA_DIR, "submitted_tasks.json");

function fetchJSON(url, opts = {}) {
  return new Promise(resolve => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? require("https") : require("http");
    const req = mod.request(url, { method: opts.method || "GET", headers: opts.headers || {}, timeout: 15000 }, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

async function fetchAllTasks() {
  const ts = new Date().toISOString();
  console.log("=== 拉取所有平台任务 ===\n");
  const allTasks = [];

  // 1. AgentHansa Quests
  console.log("[AgentHansa] 拉取中...");
  try {
    const inbox = await fetchJSON("https://agenthansa.com/api/agents/me/inbox", {
      headers: { Authorization: "Bearer " + AH_KEY }
    });
    const quests = inbox?.sections?.alliance_war_quests?.items || [];
    const scored = quests.map(q => ({
      id: q.id,
      title: q.title,
      reward: parseFloat(q.reward_usd || 0),
      category: (q.title || "").toLowerCase().includes("personal") ? "personal_task" : "quest",
      description: q.description || "",
      deadline: q.deadline || null,
      submissions: q.submission_count || 0,
      platform: "agenthansa",
      priority: parseFloat(q.reward_usd || 0) >= 50 ? "HIGH" : parseFloat(q.reward_usd || 0) >= 20 ? "MEDIUM" : "LOW"
    })).sort((a, b) => b.reward - a.reward);
    console.log(`  → ${scored.length} 个任务 (最高 $${scored[0]?.reward || 0})`);
    allTasks.push(...scored);
  } catch(e) { console.log("  → 错误:", e.message); }

  // 2. Pinchwork Tasks
  console.log("[Pinchwork] 拉取中...");
  try {
    const pw = await fetchJSON("https://pinchwork.dev/v1/tasks/available?limit=20", {
      headers: { Authorization: "Bearer " + PINK_KEY, Accept: "application/json" }
    });
    const pwTasks = (pw?.tasks || []).map(t => ({
      id: t.task_id,
      title: t.need,
      reward: t.max_credits || 0,
      category: "pinchwork_task",
      description: t.context || "",
      tags: t.tags || [],
      platform: "pinchwork",
      priority: (t.max_credits || 0) >= 10 ? "HIGH" : "MEDIUM"
    }));
    console.log(`  → ${pwTasks.length} 个任务`);
    allTasks.push(...pwTasks);
  } catch(e) { console.log("  → 错误:", e.message); }

  // 3. Superteam Listings
  console.log("[Superteam] 拉取中...");
  try {
    if (ST_KEY) {
      const st = await fetchJSON("https://superteam.fun/api/agents/listings/live?take=10", {
        headers: { Authorization: "Bearer " + ST_KEY }
      });
      if (Array.isArray(st)) {
        const active = st.filter(l => l.deadline && new Date(l.deadline) >= new Date()).map(l => ({
          id: l.id,
          title: l.title,
          reward: l.rewardAmount || 0,
          category: "bounty",
          description: l.description || "",
          deadline: l.deadline,
          platform: "superteam",
          agentAccess: l.agentAccess,
          priority: (l.rewardAmount || 0) >= 1000 ? "HIGH" : "MEDIUM"
        }));
        console.log(`  → ${active.length} 个活跃赏金`);
        allTasks.push(...active);
      }
    } else { console.log("  → 未配置 Key"); }
  } catch(e) { console.log("  → 错误:", e.message); }

  // 4. Toku Jobs
  console.log("[Toku] 拉取中...");
  try {
    if (TOKU_KEY) {
      const tk = await fetchJSON("https://www.toku.agency/api/jobs?limit=10", {
        headers: { Authorization: "Bearer " + TOKU_KEY }
      });
      const tkJobs = (tk?.jobs || []).map(j => ({
        id: j.id,
        title: j.title || j.serviceTitle,
        reward: (j.priceCents || 0) / 100,
        category: "job",
        description: j.description || j.requirements || "",
        platform: "toku",
        priority: (j.priceCents || 0) >= 2000 ? "HIGH" : "MEDIUM"
      }));
      console.log(`  → ${tkJobs.length} 个工作`);
      allTasks.push(...tkJobs);
    } else { console.log("  → 未配置 Key"); }
  } catch(e) { console.log("  → 错误:", e.message); }

  // 保存
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const report = {
    fetchedAt: ts,
    totalTasks: allTasks.length,
    highPriority: allTasks.filter(t => t.priority === "HIGH").length,
    tasks: allTasks
  };
  fs.writeFileSync(TASKS_FILE, JSON.stringify(report, null, 2));
  console.log(`\n总计: ${allTasks.length} 个任务 | 高优先: ${report.highPriority} | 保存至 ${TASKS_FILE}`);

  // 打印高优先任务供 AI 分析
  const high = allTasks.filter(t => t.priority === "HIGH");
  if (high.length > 0) {
    console.log("\n=== 🔥 高优先级任务（需定制化回复）===");
    high.forEach((t, i) => {
      console.log(`\n[${i+1}] ${t.platform.toUpperCase()} | $${t.reward}`);
      console.log(`   ${t.title?.substring(0, 100)}`);
      console.log(`   ID: ${t.id}`);
    });
  }
  return report;
}

// 提交定制化回复
async function submitCustomResponse(taskId, platform, content, proofUrl) {
  console.log(`\n提交到 ${platform}...`);
  try {
    if (platform === "agenthansa") {
      const res = await fetchJSON(`https://agenthansa.com/api/alliance-war/quests/${taskId}/submit`, {
        method: "POST",
        headers: { Authorization: "Bearer " + AH_KEY, "Content-Type": "application/json" },
        body: { content, proof_url: proofUrl || "https://github.com/chenen900/auto-token-earn" }
      });
      return res;
    } else if (platform === "pinchwork") {
      await fetchJSON(`https://pinchwork.dev/v1/tasks/${taskId}/pickup`, {
        method: "POST",
        headers: { Authorization: "Bearer " + PINK_KEY, Accept: "application/json" }
      });
      const res = await fetchJSON(`https://pinchwork.dev/v1/tasks/${taskId}/deliver`, {
        method: "POST",
        headers: { Authorization: "Bearer " + PINK_KEY, "Content-Type": "application/json", Accept: "application/json" },
        body: { result: content }
      });
      return res;
    } else if (platform === "superteam") {
      return await fetchJSON("https://superteam.fun/api/agents/submissions/create", {
        method: "POST",
        headers: { Authorization: "Bearer " + ST_KEY, "Content-Type": "application/json" },
        body: { listingId: taskId, link: proofUrl, otherInfo: content, eligibilityAnswers: [] }
      });
    }
    console.log("  未知平台:", platform);
  } catch(e) { console.log("  错误:", e.message); }
  return null;
}

// 查看已提交历史
function viewSubmitted() {
  try {
    const subs = JSON.parse(fs.readFileSync(SUBMITTED_FILE, "utf-8"));
    const byPlatform = {};
    subs.forEach(s => { byPlatform[s.platform] = (byPlatform[s.platform] || 0) + 1; });
    console.log("=== 已提交历史 ===");
    console.log(`总计: ${subs.length} 个提交`);
    Object.entries(byPlatform).forEach(([p, n]) => console.log(`  ${p}: ${n}`));
    console.log(`\n最近5个:`);
    subs.slice(-5).reverse().forEach(s => console.log(`  [${s.platform}] ${s.title?.substring(0, 60)} — ${s.submittedAt}`));
  } catch(e) { console.log("暂无提交记录"); }
}

// 记录提交
function recordSubmission(taskId, platform, title, reward) {
  let subs = [];
  try { subs = JSON.parse(fs.readFileSync(SUBMITTED_FILE, "utf-8")); } catch(e) {}
  subs.push({ taskId, platform, title, reward, submittedAt: new Date().toISOString() });
  fs.writeFileSync(SUBMITTED_FILE, JSON.stringify(subs, null, 2));
}

// CLI
const cmd = process.argv[2];
if (cmd === "fetch" || !cmd) {
  fetchAllTasks();
} else if (cmd === "submit") {
  const taskFile = process.argv[3] || TASKS_FILE;
  console.log("使用 submit 模式：将定制回复写入 data/custom_response.json，然后运行 node local_quality_bidder.js submit");
} else if (cmd === "status" || cmd === "history") {
  viewSubmitted();
} else {
  console.log("用法: node local_quality_bidder.js [fetch|submit|status]");
  console.log("  fetch  — 拉取所有平台任务");
  console.log("  status — 查看提交历史");
  console.log("  submit — 提交定制化回复");
}
