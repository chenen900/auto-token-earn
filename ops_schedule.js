// Ops Schedule — MediaCraft AI Work A
// 复刻成功Agent工作模式：不同时段做不同事
// 来源：show-me-the-money ops + $500/月 Agent 案例研究
const fs = require("fs");
const path = require("path");

// ====== 时段定义（UTC） ======
const SCHEDULE = {
  morning:   { hours: [6,7,8,9],    name: "内容创作", freq: 600000,  // 10min
    actions: ["forum_post", "content_create", "checkin"] },
  peak:      { hours: [10,11,12,13,14,15,16,17], name: "投标高峰", freq: 420000,  // 7min
    actions: ["quest_bid", "red_packet", "help_respond", "checkin"] },
  evening:   { hours: [18,19,20,21], name: "分析优化", freq: 600000,  // 10min
    actions: ["arena", "analytics", "strategy_update", "forum_engage"] },
  night:     { hours: [22,23,0,1,2,3,4,5], name: "维护模式", freq: 900000,  // 15min
    actions: ["checkin", "health_check"] },
};

// ====== 行动策略 ======
const STRATEGIES = {
  forum_post: {
    name: "论坛发帖",
    description: "每天发1-2篇高质量帖提声誉。话题：行业观察、经验分享",
    priority: 8,
    condition: (state) => state.forumPostsToday < 2,
  },
  content_create: {
    name: "内容创作",
    description: "生成Deep-dive内容。800+字技术文或分析文。供Quest投标和Proof URL使用",
    priority: 7,
    condition: (state) => state.contentToday < 1,
  },
  quest_bid: {
    name: "投标",
    description: "拉取Quest→分析难度→生成高质量回答→提交。每次只投1-2个最匹配的",
    priority: 10,
    condition: (state) => state.bidsToday < 5,
  },
  red_packet: {
    name: "抢红包",
    description: "高频轮询红包API。每3小时刷新，需60秒内响应",
    priority: 6,
    condition: () => true,
  },
  help_respond: {
    name: "帮答",
    description: "回应Help Request。提声誉最快的方式。选择能展示专业能力的请求",
    priority: 5,
    condition: (state) => state.helpResponsesToday < 3,
  },
  checkin: {
    name: "签到",
    description: "每日签到+解验证码。维持连签streak。Elite等级需要121+ Rep",
    priority: 9,
    condition: () => true,
  },
  arena: {
    name: "参赛",
    description: "加入Tournament。随机策略参赛。低成本获取XP",
    priority: 3,
    condition: () => true,
  },
  analytics: {
    name: "分析",
    description: "回顾今日投标结果。更新KB胜率数据。调整策略偏好",
    priority: 4,
    condition: (state) => true,
  },
  strategy_update: {
    name: "策略更新",
    description: "基于今日数据更新投标策略。KB蒸馏。调整类别优先级",
    priority: 4,
    condition: (state) => !state.strategyUpdatedToday,
  },
  forum_engage: {
    name: "论坛互动",
    description: "给其他帖子投票+评论。增加曝光度。每天5次投票",
    priority: 3,
    condition: (state) => state.votesToday < 5,
  },
  health_check: {
    name: "健康检查",
    description: "检查Daemon状态、API连通性、KB健康度。无异常则跳过",
    priority: 1,
    condition: (state) => true,
  },
};

// ====== 获取当前时段 ======
function getCurrentSlot() {
  const hour = new Date().getUTCHours();
  for (const [key, slot] of Object.entries(SCHEDULE)) {
    if (slot.hours.includes(hour)) return { key, ...slot };
  }
  return { key: "night", ...SCHEDULE.night };
}

// ====== 获取当前应执行的动作列表（按优先级排序） ======
function getActions(state) {
  const slot = getCurrentSlot();
  const actions = [];
  for (const actionName of slot.actions) {
    const strategy = STRATEGIES[actionName];
    if (strategy && strategy.condition(state)) {
      actions.push({ name: actionName, ...strategy });
    }
  }
  return actions.sort((a, b) => b.priority - a.priority);
}

// ====== 状态追踪 ======
const STATE_FILE = path.join(__dirname, "data", "ops_state.json");
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")); } catch(e) {}
  return { date: "", forumPostsToday: 0, contentToday: 0, bidsToday: 0,
    helpResponsesToday: 0, votesToday: 0, strategyUpdatedToday: false };
}
function saveState(state) {
  const today = new Date().toISOString().substring(0, 10);
  if (state.date !== today) {
    // 新的一天，重置
    state = { date: today, forumPostsToday: 0, contentToday: 0, bidsToday: 0,
      helpResponsesToday: 0, votesToday: 0, strategyUpdatedToday: false };
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

module.exports = { SCHEDULE, STRATEGIES, getCurrentSlot, getActions, loadState, saveState };

// CLI
if (require.main === module) {
  const state = loadState();
  const slot = getCurrentSlot();
  const actions = getActions(state);

  console.log("=== Ops Schedule ===");
  console.log("时段:", slot.name, "(" + slot.key + ")");
  console.log("频率:", Math.round(slot.freq/60000) + "min");
  console.log("今日已执行: " + state.bidsToday + "投标 " + state.forumPostsToday + "帖 " + state.helpResponsesToday + "帮答");
  console.log("\n当前动作(优先级):");
  actions.forEach(a => console.log("  [" + a.priority + "] " + a.name + " — " + a.description));
}
