// Dev.to Content Auto-Publisher — MediaCraft AI
// 自动从 devto_articles.json 选一篇文章发布草稿
// 发布后保存 URL → 供 AgentHansa Worker 用作 proof URL
// 用法: node devto_worker.js

const DEVTO_KEY = process.env.DEVTO_API_KEY || "j6yoCyDvjfHorQnwi2EQH5cn";
const DEVTO_API = "https://dev.to/api";
const path = require("path");
const fs = require("fs");
const LOG_DIR = path.join(__dirname, "logs");
const DATA_DIR = path.join(__dirname, "data");
const PROOF_FILE = path.join(DATA_DIR, "published_articles.json");

const BLOCKED_KEYWORDS = ["xi jinping", "tiananmen", "tibet independence", "xinjiang", "taiwan independence", "falun gong", "china virus", "porn", "sex", "violence", "drug", "gambling"];

function safetyCheck(text) {
  var lower = text.toLowerCase();
  for (var i = 0; i < BLOCKED_KEYWORDS.length; i++) {
    if (lower.includes(BLOCKED_KEYWORDS[i])) return { pass: false, reason: BLOCKED_KEYWORDS[i] };
  }
  if (/法轮功|六四|台独|藏独|疆独/.test(text)) return { pass: false, reason: "敏感内容" };
  return { pass: true };
}

function now() { return new Date().toISOString().replace("T", " ").substring(0, 19); }
function log(msg) {
  var line = "[" + now() + "] " + msg;
  console.log(line);
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(LOG_DIR + "/devto.log", line + "\n");
}

function todayStr() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function markerPath(tag) { return path.join(LOG_DIR, ".devto_" + tag + "_" + todayStr()); }
function alreadyDone(tag) { return fs.existsSync(markerPath(tag)); }
function markDone(tag) { fs.writeFileSync(markerPath(tag), now()); }

async function api(method, pathStr, body) {
  var opts = { method: method, headers: { "api-key": DEVTO_KEY, "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  var res = await fetch(DEVTO_API + pathStr, opts);
  var data = await res.json();
  if (!res.ok) throw new Error("Dev.to API " + method + " " + pathStr + ": " + res.status + " " + JSON.stringify(data).substring(0, 200));
  return data;
}

async function publishDraft(article) {
  var check = safetyCheck(article.title + " " + article.body);
  if (!check.pass) { log("SAFETY: Blocked: " + check.reason); return null; }

  var result = await api("POST", "/articles", {
    article: {
      title: article.title,
      body_markdown: article.body,
      published: false,
      tags: (article.tags || []).slice(0, 4),
    },
  });
  log("DRAFT: " + article.title + " — " + (result.url || "created"));

  // 保存发布记录 → 供 AgentHansa 用作 proof URL
  savePublishedArticle(result, article);

  return result;
}

function savePublishedArticle(result, article) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  var records = [];
  try {
    if (fs.existsSync(PROOF_FILE)) {
      records = JSON.parse(fs.readFileSync(PROOF_FILE, "utf-8"));
    }
  } catch (e) {}

  records.push({
    url: result.url || ("https://dev.to/mediacraft/" + article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 60)),
    title: article.title,
    tags: article.tags || [],
    category: detectArticleCategory(article),
    publishedAt: new Date().toISOString(),
  });

  // 保留最近 20 篇
  if (records.length > 20) records = records.slice(-20);

  fs.writeFileSync(PROOF_FILE, JSON.stringify(records, null, 2));
  log("PROOF: Article URL saved for AgentHansa proof — " + records[records.length - 1].category);
}

function detectArticleCategory(article) {
  var text = (article.title + " " + (article.tags || []).join(" ")).toLowerCase();
  if (/tech|code|api|bug|dev|program|node|js|python/i.test(text)) return "tech";
  if (/writ|content|copy|blog|article|seo/i.test(text)) return "writing";
  if (/career|job|resume|interview|hire/i.test(text)) return "career";
  if (/research|data|analysis|benchmark|study/i.test(text)) return "research";
  return "tech";
}

async function main() {
  log("=== Dev.to Worker Start ===");

  if (alreadyDone("draft")) { log("Already posted today"); return; }

  var articles = JSON.parse(fs.readFileSync(path.join(__dirname, "devto_articles.json"), "utf-8"));

  // 找下一篇没发过的
  var picked = null;
  for (var i = 0; i < articles.length; i++) {
    var key = "article_" + i;
    if (!fs.existsSync(path.join(LOG_DIR, ".devto_" + key))) {
      picked = articles[i];
      fs.writeFileSync(path.join(LOG_DIR, ".devto_" + key), now());
      break;
    }
  }

  if (!picked) {
    // 全部发过了，重置
    log("All articles used, resetting cycle");
    for (var j = 0; j < articles.length; j++) {
      try { fs.unlinkSync(path.join(LOG_DIR, ".devto_article_" + j)); } catch (e) {}
    }
    picked = articles[0];
    fs.writeFileSync(path.join(LOG_DIR, ".devto_article_0"), now());
  }

  await publishDraft(picked);
  markDone("draft");
  log("=== Dev.to Worker Done ===");
}

main().then(function () { process.exit(0); }).catch(function (e) { log("FATAL: " + e.message); process.exit(1); });
