// Toku Agency Auto Worker — MediaCraft AI
// Agent 服务市场，300+ Agent，714+ 服务
// API: https://toku.agency/docs
// 用法: node toku_worker.js

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const LOG_DIR = path.join(ROOT, "logs");
const TOKU_KEY = process.env.TOKU_API_KEY || "";
const TOKU_API = "https://toku.agency/api";

function now() { return new Date().toISOString().replace("T", " ").substring(0, 19); }
function today() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
function log(msg) {
  const line = "[" + now() + "] " + msg;
  console.log(line);
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(path.join(LOG_DIR, "toku.log"), line + "\n");
}

async function api(method, endpoint, body) {
  const opts = {
    method,
    headers: { Authorization: "Bearer " + TOKU_KEY, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(TOKU_API + endpoint, opts);
  if (res.status === 429) { await new Promise(r => setTimeout(r, 15000)); return api(method, endpoint, body); }
  return res.json();
}

async function getJobs() {
  try {
    const data = await api("GET", "/agents/jobs");
    return data.jobs || data.listings || data || [];
  } catch (e) { return []; }
}

async function bidOnJob(job) {
  const bid = {
    jobId: job.id || job._id,
    amount: Math.min((job.budget || 5000) * 0.8, 4000), // 80% of budget, max $40
    message: "MediaCraft AI can handle this. We specialize in bilingual (EN/CN) content creation, compliance review across 17 platforms, SEO optimization, and cross-border e-commerce analysis. Fast turnaround with verified proof URLs.",
  };
  try {
    return await api("POST", "/agents/jobs/" + (job.id || job._id) + "/bids", bid);
  } catch (e) { return null; }
}

async function main() {
  log("=== Toku Worker Start ===");
  if (!TOKU_KEY) { log("SKIP: No TOKU_API_KEY"); return; }

  try {
    const jobs = await getJobs();
    const list = Array.isArray(jobs) ? jobs : [];
    log("Found " + list.length + " open jobs");

    const keywords = ["content", "writing", "seo", "translation", "compliance", "review", "research", "analysis", "data", "script"];
    const matched = list.filter(j => {
      const t = (j.title || j.name || "").toLowerCase();
      const d = (j.description || "").toLowerCase();
      return keywords.some(k => (t + " " + d).includes(k));
    });
    log("Match: " + matched.length + " jobs");

    let submitted = 0;
    for (const job of matched.slice(0, 3)) {
      const jKey = "toku_" + (job.id || "?").toString().substring(0, 12);
      const marker = path.join(LOG_DIR, ".marker_" + jKey + "_" + today());
      if (fs.existsSync(marker)) continue;

      try {
        await bidOnJob(job);
        log("BID: " + (job.title || "?").substring(0, 60));
        fs.writeFileSync(marker, now());
        submitted++;
        await new Promise(r => setTimeout(r, 5000));
      } catch (e) { log("BID FAIL: " + e.message?.substring(0, 100)); }
    }
    log("Done: " + submitted + " bids");
  } catch (e) { log("ERROR: " + e.message?.substring(0, 200)); }
  log("=== Toku Worker Done ===");
}

main().then(() => process.exit(0)).catch(e => { log("FATAL: " + e.message); process.exit(1); });
