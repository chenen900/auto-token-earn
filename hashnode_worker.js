// Hashnode Auto-Publisher — MediaCraft AI
// 复用 Dev.to 文章库，自动发布到 Hashnode（双平台 SEO）
// API: https://api.hashnode.com
// 用法: node hashnode_worker.js

const HASHNODE_KEY = process.env.HASHNODE_API_KEY || "";
const HASHNODE_API = "https://gql.hashnode.com";
const path = require("path");
const fs = require("fs");
const ROOT = __dirname;
const LOG_DIR = path.join(ROOT, "logs");
const DATA_DIR = path.join(ROOT, "data");

// 内容安全
const BLOCKED = ["xi jinping", "tiananmen", "tibet independence", "xinjiang", "taiwan independence", "falun gong", "china virus", "porn", "sex", "violence", "drug", "gambling"];
function safety(text) {
  const l = text.toLowerCase();
  for (const kw of BLOCKED) { if (l.includes(kw)) return { pass: false, reason: kw }; }
  if (/法轮功|六四|台独|藏独|疆独/.test(text)) return { pass: false, reason: "敏感" };
  return { pass: true };
}

function now() { return new Date().toISOString().replace("T", " ").substring(0, 19); }
function today() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function log(msg) {
  const line = "[" + now() + "] " + msg;
  console.log(line);
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(path.join(LOG_DIR, "hashnode.log"), line + "\n");
}
function done(tag) { return fs.existsSync(path.join(LOG_DIR, ".hn_" + tag + "_" + today())); }
function mark(tag) { fs.writeFileSync(path.join(LOG_DIR, ".hn_" + tag + "_" + today()), now()); }

async function gql(query, variables) {
  const res = await fetch(HASHNODE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: HASHNODE_KEY },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data;
}

async function publishPost(article) {
  const check = safety(article.title + " " + article.body);
  if (!check.pass) { log("SAFETY: " + check.reason); return null; }

  const query = `
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post { id url title slug }
      }
    }`;

  const result = await gql(query, {
    input: {
      title: article.title,
      contentMarkdown: article.body,
      tags: (article.tags || []).slice(0, 5).map((t) => ({ name: t, slug: t.toLowerCase().replace(/[^a-z0-9]/g, "-") })),
      publicationId: process.env.HASHNODE_PUBLICATION_ID || "",
    },
  });

  const post = result.publishPost.post;
  log("PUBLISHED: " + post.title + " — " + post.url);

  // 保存到 proof pool
  saveToProofPool(post, article);
  return post;
}

function saveToProofPool(post, article) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const proofFile = path.join(DATA_DIR, "published_articles.json");
  let records = [];
  try { if (fs.existsSync(proofFile)) records = JSON.parse(fs.readFileSync(proofFile, "utf-8")); } catch (e) {}

  records.push({
    url: post.url,
    title: post.title,
    tags: article.tags || [],
    category: detectCategory(article),
    platform: "hashnode",
    publishedAt: new Date().toISOString(),
  });
  if (records.length > 30) records = records.slice(-30);
  fs.writeFileSync(proofFile, JSON.stringify(records, null, 2));
}

function detectCategory(article) {
  const t = (article.title + " " + (article.tags || []).join(" ")).toLowerCase();
  if (/tech|code|api|dev|program/i.test(t)) return "tech";
  if (/writ|content|blog|seo/i.test(t)) return "writing";
  if (/career|job|resume/i.test(t)) return "career";
  return "tech";
}

async function main() {
  log("=== Hashnode Worker Start ===");

  if (!HASHNODE_KEY) {
    log("SKIP: No HASHNODE_API_KEY set — register at https://hashnode.com/settings/developer");
    return;
  }
  if (done("post")) { log("Already posted today"); return; }

  const articles = JSON.parse(fs.readFileSync(path.join(ROOT, "devto_articles.json"), "utf-8"));
  let picked = null;
  for (let i = 0; i < articles.length; i++) {
    if (!fs.existsSync(path.join(LOG_DIR, ".hn_article_" + i))) {
      picked = articles[i];
      fs.writeFileSync(path.join(LOG_DIR, ".hn_article_" + i), now());
      break;
    }
  }
  if (!picked) { log("All used, resetting"); picked = articles[0]; }

  try {
    await publishPost(picked);
    mark("post");
  } catch (e) {
    log("ERROR: " + e.message.substring(0, 150));
  }
  log("=== Hashnode Worker Done ===");
}

main().then(() => process.exit(0)).catch((e) => { log("FATAL: " + e.message); process.exit(1); });
