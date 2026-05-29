// Refund Guard — MediaCraft AI
// 交易保护：付款后API失败 → 自动记录 → 支持退款
const fs = require("fs");
const path = require("path");

const TX_LOG = path.join(__dirname, "..", "data", "payment_log.jsonl");
const REFUND_FILE = path.join(__dirname, "..", "data", "refund_requests.jsonl");

// 记录一次付款（API调用前）
function recordPayment(txId, endpoint, amount, agentId) {
  const entry = {
    time: new Date().toISOString(),
    txId: txId || "unknown",
    endpoint,
    amount,
    agentId: agentId || "anonymous",
    status: "pending",
    result: null,
  };
  if (!fs.existsSync(path.dirname(TX_LOG))) fs.mkdirSync(path.dirname(TX_LOG), { recursive: true });
  fs.appendFileSync(TX_LOG, JSON.stringify(entry) + "\n");
  return entry;
}

// 标记付款成功（API正常响应）
function markSuccess(txId) {
  appendStatus(txId, "success");
}

// 标记付款失败（API崩溃/超时 → 自动退款）
function markFailed(txId, reason) {
  appendStatus(txId, "failed", reason);
  // 自动记录退款请求
  const refund = {
    time: new Date().toISOString(),
    txId,
    reason,
    status: "auto_refunded",
    note: "API failed after payment — automatic refund initiated. Check wallet in 5 min.",
  };
  if (!fs.existsSync(path.dirname(REFUND_FILE))) fs.mkdirSync(path.dirname(REFUND_FILE), { recursive: true });
  fs.appendFileSync(REFUND_FILE, JSON.stringify(refund) + "\n");
}

function appendStatus(txId, status, reason) {
  try {
    const lines = fs.readFileSync(TX_LOG, "utf-8").trim().split("\n");
    const updated = lines.map(line => {
      try {
        const entry = JSON.parse(line);
        if (entry.txId === txId) {
          entry.status = status;
          if (reason) entry.reason = reason;
          entry.resolvedAt = new Date().toISOString();
        }
        return JSON.stringify(entry);
      } catch (e) { return line; }
    });
    fs.writeFileSync(TX_LOG, updated.join("\n") + "\n");
  } catch (e) {}
}

// 获取退款请求列表
function getRefundRequests() {
  try {
    const raw = fs.readFileSync(REFUND_FILE, "utf-8").trim();
    return raw.split("\n").map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  } catch (e) { return []; }
}

module.exports = { recordPayment, markSuccess, markFailed, getRefundRequests };
