// Blacklist System — MediaCraft AI
// 拉黑原则：宁可不判，绝不误判。完整链路验证后才拉黑。
// 流程：提供服务→确认完成→等待付款→确认API正常→确认未付→拉黑
const fs = require("fs");
const path = require("path");

const BLACKLIST_FILE = path.join(__dirname, "data", "blacklist.json");
const USAGE_FILE = path.join(__dirname, "data", "usage_for_billing.jsonl");

// ====== 使用记录（谁用了什么，什么时候） ======
function recordUsage(agentId, endpoint, result) {
  const entry = {
    time: new Date().toISOString(),
    agentId: agentId || "anonymous",
    endpoint,
    result: result ? "success" : "failed",
    paid: false,
    verified: false,
  };
  if (!fs.existsSync(path.dirname(USAGE_FILE))) fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
  fs.appendFileSync(USAGE_FILE, JSON.stringify(entry) + "\n");
  return entry;
}

// 标记付款
function markAsPaid(agentId, txId) {
  updateUsageField(agentId, "paid", true, txId);
}

// ====== 黑名单加载 ======
function loadBlacklist() {
  try { return JSON.parse(fs.readFileSync(BLACKLIST_FILE, "utf-8")); } catch(e) { return []; }
}

function saveBlacklist(list) {
  fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(list, null, 2));
}

// ====== 拉黑流程（多重验证） ======
function addToBlacklist(agentId, reason, evidence) {
  // 第1步：检查是否已有记录
  const existing = loadBlacklist();
  if (existing.find(e => e.agentId === agentId)) return { ok: false, reason: "已在黑名单中" };

  // 第2步：验证证据完整性
  if (!evidence.serviceDelivered) return { ok: false, reason: "缺少服务交付证明" };
  if (!evidence.paymentMissing) return { ok: false, reason: "缺少未付款证明" };
  if (!evidence.apiHealthyAtTime) return { ok: false, reason: "缺少API健康状态证明" };

  // 第3步：确认服务确实完成
  const usageLog = getUsageHistory(agentId);
  const lastService = usageLog.find(e => e.result === "success");
  if (!lastService) return { ok: false, reason: "未找到成功的服务记录" };

  // 第4步：确认超过合理等待时间（≥24小时）
  const hoursSinceService = (Date.now() - new Date(lastService.time).getTime()) / 3600000;
  if (hoursSinceService < 24) return { ok: false, reason: `仅过${Math.round(hoursSinceService)}小时，需等待24小时后才可拉黑` };

  // 第5步：确认API当时健康
  if (!evidence.apiHealthyAtTime) return { ok: false, reason: "无法确认API在服务时健康" };

  // 全部通过 → 拉黑
  const entry = {
    agentId,
    reason,
    evidence,
    blacklistedAt: new Date().toISOString(),
    serviceCount: usageLog.length,
    lastServiceTime: lastService.time,
    reviewStatus: "pending_human_review", // 人类最终确认
  };

  existing.push(entry);
  saveBlacklist(existing);

  console.log("BLACKLIST: " + agentId + " — pending human review");
  return { ok: true, entry };
}

// 人类确认后才生效
function confirmBlacklist(agentId, confirmed) {
  const list = loadBlacklist();
  const entry = list.find(e => e.agentId === agentId);
  if (!entry) return { ok: false, reason: "不在待审核列表" };
  entry.reviewStatus = confirmed ? "confirmed" : "rejected";
  entry.reviewedAt = new Date().toISOString();
  saveBlacklist(list);
  return { ok: true, status: entry.reviewStatus };
}

// 检查是否被拉黑
function isBlacklisted(agentId) {
  const list = loadBlacklist();
  return list.some(e => e.agentId === agentId && e.reviewStatus === "confirmed");
}

// 获取使用历史
function getUsageHistory(agentId) {
  try {
    const raw = fs.readFileSync(USAGE_FILE, "utf-8").trim();
    return raw.split("\n")
      .map(l => { try { return JSON.parse(l); } catch(e) { return null; } })
      .filter(Boolean)
      .filter(e => e.agentId === agentId);
  } catch(e) { return []; }
}

function updateUsageField(agentId, field, value, txId) {
  try {
    const raw = fs.readFileSync(USAGE_FILE, "utf-8").trim();
    const updated = raw.split("\n").map(line => {
      try {
        const entry = JSON.parse(line);
        if (entry.agentId === agentId && !entry[field]) {
          entry[field] = value;
          if (txId) entry.txId = txId;
        }
        return JSON.stringify(entry);
      } catch(e) { return line; }
    });
    fs.writeFileSync(USAGE_FILE, updated.join("\n") + "\n");
  } catch(e) {}
}

// ====== 白名单（可信Agent，永远不拉黑） ======
const WHITELIST = ["MediaCraft_AI", "health-check", "anonymous"];

function canBlacklist(agentId) {
  return !WHITELIST.includes(agentId);
}

module.exports = { recordUsage, markAsPaid, addToBlacklist, confirmBlacklist, isBlacklisted, getUsageHistory, canBlacklist, loadBlacklist };

// CLI
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === "list") {
    console.log(JSON.stringify(loadBlacklist(), null, 2));
  } else if (cmd === "usage") {
    const agentId = process.argv[3] || "anonymous";
    console.log(JSON.stringify(getUsageHistory(agentId), null, 2));
  } else {
    console.log("Usage: node blacklist.js [list|usage <agentId>]");
  }
}
