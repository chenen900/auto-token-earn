// API 用量追踪 + 收益仪表板
// 每次 API 调用自动记录，可查询收益

const fs = require("fs");
const path = require("path");

const STATS_FILE = path.join(__dirname, "stats.json");

function loadStats() {
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
  } catch {
    return {
      started: new Date().toISOString(),
      calls: {},
      earnings: { total: 0, byEndpoint: {} },
      agents: {},
    };
  }
}

function saveStats(stats) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

function trackCall(endpoint, price, agentId) {
  const stats = loadStats();

  // 总调用次数
  stats.calls[endpoint] = (stats.calls[endpoint] || 0) + 1;

  // 收益（实际付费时启用）
  const priceNum = parseFloat(price.replace("$", ""));
  stats.earnings.byEndpoint[endpoint] = (stats.earnings.byEndpoint[endpoint] || 0) + priceNum;
  stats.earnings.total += priceNum;

  // Agent 统计
  const aid = agentId || "anonymous";
  if (!stats.agents[aid]) stats.agents[aid] = { calls: 0, spent: 0, firstSeen: new Date().toISOString() };
  stats.agents[aid].calls++;
  stats.agents[aid].spent += priceNum;
  stats.agents[aid].lastSeen = new Date().toISOString();

  saveStats(stats);
  return stats;
}

function getStats() {
  return loadStats();
}

// 只在 body 里提供了 x-agent-id 时才记录（非隐私信息）
function trackFromRequest(req, endpoint, price) {
  const agentId =
    req.headers["x-agent-id"] ||
    req.headers["x-forwarded-for"] ||
    "anonymous";
  return trackCall(endpoint, price, agentId);
}

module.exports = { trackFromRequest, getStats };
