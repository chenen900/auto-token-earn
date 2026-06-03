// Quest Pipeline — 本地任务队列系统
// inbox: daemon 写入待处理 quest → AI 处理 → outbox: 写入回复 → daemon 提交
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const INBOX_DIR = path.join(DATA_DIR, "quests_inbox");
const OUTBOX_DIR = path.join(DATA_DIR, "quests_outbox");
const ARCHIVE_DIR = path.join(DATA_DIR, "quests_archive");

function ensureDirs() {
  for (const d of [INBOX_DIR, OUTBOX_DIR, ARCHIVE_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

// ====== 收件箱：保存 quest ======
function saveQuest(quest) {
  ensureDirs();
  const id = quest.id || ("q_" + Date.now());
  const file = path.join(INBOX_DIR, id + ".json");

  // 去重：如果已存在且内容相同，跳过
  if (fs.existsSync(file)) {
    try {
      const existing = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (existing.title === quest.title && existing.reward_usd === quest.reward_usd) {
        return { id, duplicate: true };
      }
    } catch(e) {}
  }

  const record = {
    id: id,
    title: quest.title || "",
    description: quest.description || "",
    reward_usd: parseFloat(quest.reward_usd) || 0,
    category: quest.category || detectCategory(quest.title || ""),
    evaluation_category: quest.evaluation_category || "",
    created_at: quest.created_at || new Date().toISOString(),
    saved_at: new Date().toISOString(),
    status: "pending",      // pending → processing → ready → submitted → archived
    response: null,
    metadata: quest.metadata || {},
    raw: quest  // 保留原始数据
  };

  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  return { id, duplicate: false, file };
}

// ====== 获取所有待处理 quest ======
function getPendingQuests() {
  ensureDirs();
  const files = fs.readdirSync(INBOX_DIR).filter(f => f.endsWith(".json"));
  const quests = [];
  for (const f of files) {
    try {
      const q = JSON.parse(fs.readFileSync(path.join(INBOX_DIR, f), "utf-8"));
      if (q.status === "pending" || q.status === "processing") {
        quests.push({ ...q, _file: f });
      }
    } catch(e) {}
  }
  // 按赏金降序排列
  return quests.sort((a, b) => b.reward_usd - a.reward_usd);
}

// ====== 获取单个 quest ======
function getQuest(questId) {
  ensureDirs();
  // 先在 inbox 找
  let file = path.join(INBOX_DIR, questId + ".json");
  if (fs.existsSync(file)) {
    return { ...JSON.parse(fs.readFileSync(file, "utf-8")), _file: questId + ".json" };
  }
  // 再在 outbox 找
  file = path.join(OUTBOX_DIR, questId + ".json");
  if (fs.existsSync(file)) {
    return { ...JSON.parse(fs.readFileSync(file, "utf-8")), _file: questId + ".json", _location: "outbox" };
  }
  return null;
}

// ====== 标记为处理中 ======
function markProcessing(questId) {
  ensureDirs();
  const file = path.join(INBOX_DIR, questId + ".json");
  if (!fs.existsSync(file)) return false;
  const q = JSON.parse(fs.readFileSync(file, "utf-8"));
  q.status = "processing";
  q.processing_at = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(q, null, 2));
  return true;
}

// ====== 发件箱：保存 AI 生成的回复 ======
function saveResponse(questId, response) {
  ensureDirs();
  const inboxFile = path.join(INBOX_DIR, questId + ".json");

  let quest;
  if (fs.existsSync(inboxFile)) {
    quest = JSON.parse(fs.readFileSync(inboxFile, "utf-8"));
  } else {
    // 可能在 outbox 已有
    const outboxFile = path.join(OUTBOX_DIR, questId + ".json");
    if (fs.existsSync(outboxFile)) {
      quest = JSON.parse(fs.readFileSync(outboxFile, "utf-8"));
    } else {
      return { error: "quest not found: " + questId };
    }
  }

  quest.response = typeof response === "string" ? { content: response } : response;
  quest.status = "ready";
  quest.responded_at = new Date().toISOString();

  // 移入 outbox
  const outboxFile = path.join(OUTBOX_DIR, questId + ".json");
  fs.writeFileSync(outboxFile, JSON.stringify(quest, null, 2));

  // 从 inbox 删除
  if (fs.existsSync(inboxFile)) {
    fs.unlinkSync(inboxFile);
  }

  return { id: questId, status: "ready" };
}

// ====== 检查是否有准备好的回复 ======
function getReadyResponse(questId) {
  ensureDirs();
  const file = path.join(OUTBOX_DIR, questId + ".json");
  if (!fs.existsSync(file)) return null;

  const q = JSON.parse(fs.readFileSync(file, "utf-8"));
  if (q.status === "ready" && q.response) {
    return q.response;
  }
  return null;
}

// ====== 获取所有就绪的回复 ======
function getReadyResponses() {
  ensureDirs();
  const files = fs.readdirSync(OUTBOX_DIR).filter(f => f.endsWith(".json"));
  const ready = [];
  for (const f of files) {
    try {
      const q = JSON.parse(fs.readFileSync(path.join(OUTBOX_DIR, f), "utf-8"));
      if (q.status === "ready" && q.response) {
        ready.push({ questId: q.id, title: q.title, reward_usd: q.reward_usd, response: q.response });
      }
    } catch(e) {}
  }
  return ready;
}

// ====== 标记为已提交 ======
function markSubmitted(questId) {
  ensureDirs();
  const outboxFile = path.join(OUTBOX_DIR, questId + ".json");
  if (!fs.existsSync(outboxFile)) return false;

  const q = JSON.parse(fs.readFileSync(outboxFile, "utf-8"));
  q.status = "submitted";
  q.submitted_at = new Date().toISOString();
  fs.writeFileSync(outboxFile, JSON.stringify(q, null, 2));
  return true;
}

// ====== 归档已完成 ======
function archive(questId) {
  ensureDirs();
  const outboxFile = path.join(OUTBOX_DIR, questId + ".json");
  if (!fs.existsSync(outboxFile)) return false;

  const q = JSON.parse(fs.readFileSync(outboxFile, "utf-8"));
  q.status = "archived";
  q.archived_at = new Date().toISOString();

  const archiveFile = path.join(ARCHIVE_DIR, questId + ".json");
  fs.writeFileSync(archiveFile, JSON.stringify(q, null, 2));

  fs.unlinkSync(outboxFile);
  return true;
}

// ====== 统计 ======
function stats() {
  ensureDirs();
  const inbox = fs.readdirSync(INBOX_DIR).filter(f => f.endsWith(".json")).length;
  const outbox = fs.readdirSync(OUTBOX_DIR).filter(f => f.endsWith(".json")).length;
  const archive = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith(".json")).length;

  // outbox 中的状态细分
  let ready = 0, submitted = 0;
  for (const f of fs.readdirSync(OUTBOX_DIR).filter(f => f.endsWith(".json"))) {
    try {
      const q = JSON.parse(fs.readFileSync(path.join(OUTBOX_DIR, f), "utf-8"));
      if (q.status === "ready") ready++;
      if (q.status === "submitted") submitted++;
    } catch(e) {}
  }

  return {
    inbox_pending: inbox,
    outbox_ready: ready,
    outbox_submitted: submitted,
    outbox_total: outbox,
    archived: archive,
    total_processed: submitted + archive
  };
}

// ====== 辅助：从标题检测类别 ======
function detectCategory(title) {
  const t = (title || "").toLowerCase();
  const map = {
    tech: ["tech", "code", "debug", "program", "dev", "api", "server", "bug", "fix", "error", "deploy", "docker", "aws", "cloud"],
    writing: ["write", "blog", "article", "content", "post", "story", "essay", "newsletter"],
    translation: ["translat", "chinese", "english", "bilingual", "language"],
    compliance: ["complian", "legal", "law", "regulation", "policy", "audit"],
    research: ["research", "analys", "data", "report", "study", "survey", "market"],
    career: ["career", "job", "resume", "interview", "salary", "hire"],
    shopping: ["shop", "buy", "product", "recommend", "review", "best", "gift"],
    social: ["twitter", "social", "post", "tweet", "facebook", "instagram"]
  };
  for (const [cat, keywords] of Object.entries(map)) {
    if (keywords.some(k => t.includes(k))) return cat;
  }
  return "general";
}

module.exports = {
  saveQuest, getPendingQuests, getQuest,
  markProcessing, saveResponse, getReadyResponse, getReadyResponses,
  markSubmitted, archive, stats, detectCategory
};
