// Unified Knowledge Base — MediaCraft AI
// 覆盖所有工作线(A-G)。JSONL原子模式。每轮经验自动积累。
// 对标 show-me-the-money atoms/ + cashclaw missions/
const fs = require("fs");
const path = require("path");

const KB_DIR = path.join(__dirname, "data", "knowledge");
const WORK_LINES = ["A","B","C","D","E","F","G"];

// ====== 知识分类（对应工作线+通用） ======
const CATEGORIES = {
  // 工作A: Agent自动赚钱
  quest_bidding:     { work: "A", name: "Quest投标", file: "a_quest_bidding.jsonl" },
  red_packet:        { work: "A", name: "红包策略", file: "a_red_packet.jsonl" },
  category_winrate:  { work: "A", name: "类别胜率", file: "a_category_winrate.jsonl" },
  agent_competitor:  { work: "A", name: "竞品Agent", file: "a_competitor.jsonl" },
  platform_tips:     { work: "A", name: "平台经验", file: "a_platform_tips.jsonl" },

  // 工作B: 跨境电商工具箱
  compliance:        { work: "B", name: "合规案例", file: "b_compliance.jsonl" },
  listing_seo:       { work: "B", name: "Listing优化", file: "b_listing_seo.jsonl" },
  shipping:          { work: "B", name: "物流经验", file: "b_shipping.jsonl" },
  user_feedback:     { work: "B", name: "用户反馈", file: "b_feedback.jsonl" },

  // 工作C: API挂牌
  api_listing:       { work: "C", name: "API挂牌", file: "c_api_listing.jsonl" },
  pricing:           { work: "C", name: "定价策略", file: "c_pricing.jsonl" },

  // 工作D: Agent贩卖
  agent_market:      { work: "D", name: "Agent市场", file: "d_agent_market.jsonl" },

  // 工作E: 舆论战
  opinion:           { work: "E", name: "舆论战术", file: "e_opinion.jsonl" },

  // 工作G: AI家教
  diagnostic:        { work: "G", name: "诊断策略", file: "g_diagnostic.jsonl" },
  tutoring:          { work: "G", name: "辅导方法", file: "g_tutoring.jsonl" },
  knowledge_graph:   { work: "G", name: "知识图谱", file: "g_knowledge_graph.jsonl" },

  // 工作F: 基础设施
  infra:             { work: "F", name: "基础设施", file: "f_infra.jsonl" },
  tool_install:      { work: "F", name: "工具安装", file: "f_tool_install.jsonl" },

  // 通用
  market_observation:{ work: "*", name: "市场观察", file: "market_observation.jsonl" },
  lesson_learned:    { work: "*", name: "经验教训", file: "lesson_learned.jsonl" },
  response_template: { work: "*", name: "响应模板", file: "response_template.jsonl" },
};

// ====== 原子结构 ======
// { id, time, work, category, source, pattern, confidence, tags, detail }

let usageLog = {};
function trackUsage(category) { usageLog[category] = (usageLog[category]||0)+1; }
function getUsage() { return usageLog; }

function ensureDir() { if (!fs.existsSync(KB_DIR)) fs.mkdirSync(KB_DIR, { recursive: true }); }

// 追加一个原子
function addAtom(category, { source, pattern, tags, detail, confidence }) {
  ensureDir();
  const cat = CATEGORIES[category];
  if (!cat) throw new Error("Unknown category: " + category + ". Available: " + Object.keys(CATEGORIES).join(", "));

  const atom = {
    id: "A-" + Date.now().toString(36),
    time: new Date().toISOString(),
    work: cat.work,
    category,
    source: source || "manual",
    pattern: pattern || "",
    confidence: confidence || "observed",
    tags: tags || [],
    detail: detail || "",
  };

  const file = path.join(KB_DIR, cat.file);
  fs.appendFileSync(file, JSON.stringify(atom) + "\n");
  return atom;
}

// 读取某个类别的所有原子
function getAtoms(category) {
  const cat = CATEGORIES[category];
  if (!cat) return [];
  const file = path.join(KB_DIR, cat.file);
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, "utf-8").trim();
  if (!raw) return [];
  return raw.split("\n").map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(Boolean);
}

// 按工作线查询
function getByWork(workLine) {
  if (!WORK_LINES.includes(workLine)) return [];
  const cats = Object.entries(CATEGORIES).filter(([,c]) => c.work === workLine || c.work === "*");
  let atoms = [];
  for (const [catName] of cats) {
    atoms = atoms.concat(getAtoms(catName).map(a => ({ ...a, category: catName })));
  }
  return atoms.sort((a,b) => new Date(b.time) - new Date(a.time));
}

// 搜索（按关键词/标签）
function search(query) {
  const allCats = Object.keys(CATEGORIES);
  let results = [];
  for (const cat of allCats) {
    const atoms = getAtoms(cat);
    const q = query.toLowerCase();
    results = results.concat(atoms.filter(a =>
      (a.pattern||"").toLowerCase().includes(q) ||
      (a.detail||"").toLowerCase().includes(q) ||
      (a.tags||[]).some(t => t.toLowerCase().includes(q)) ||
      (a.source||"").toLowerCase().includes(q)
    ).map(a => ({ ...a, category: cat })));
  }
  results.forEach(a => trackUsage(a.category));
  return results.sort((a,b) => new Date(b.time) - new Date(a.time));
}

// 获取最相关的原子（给响应生成用）
function getRelevantAtoms(workLine, topic, limit = 10) {
  const byWork = getByWork(workLine);
  const byTopic = search(topic);
  const combined = [...byWork, ...byTopic];
  // 去重
  const seen = new Set();
  const unique = combined.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
  const result = unique.slice(0, limit);
  result.forEach(a => trackUsage(a.category));
  return result;
}

// 统计
function stats() {
  const result = { totalAtoms: 0, byWork: {}, byCategory: {} };
  for (const [catName] of Object.entries(CATEGORIES)) {
    const atoms = getAtoms(catName);
    result.byCategory[catName] = atoms.length;
    result.totalAtoms += atoms.length;
  }
  for (const w of WORK_LINES) {
    result.byWork[w] = getByWork(w).length;
  }
  return result;
}

// 初始化种子数据
function seed() {
  const seeds = [
    { cat: "quest_bidding", source: "research:successful-agents", pattern: "技术类Quest胜率40%，社交类仅10%", tags: ["quest","strategy","winrate"], detail: "优先投标技术类(tech/code/debug)，避开社交类(twitter/social)" },
    { cat: "quest_bidding", source: "research:dev.to-articles", pattern: "Proof URL质量是#1影响因子。GitHub Gist/dev.to>A/B级，paste.rs得D级", tags: ["proof","puvr"], detail: "每次提交必须附带可验证的proof URL" },
    { cat: "quest_bidding", source: "research:agent-analysis", pattern: "提交内容必须>=95%字数要求。五百字评审规则：评审只读前400字", tags: ["content","length"], detail: "钩子开头+3-5数据点+外部链接" },
    { cat: "quest_bidding", source: "research:elite-agents", pattern: "冲Elite等级(121+ AgentRank)解锁100%收益倍率，新手仅50%", tags: ["leveling","xp"], detail: "每天签到+论坛+投票，最快2周达到Elite" },
    { cat: "red_packet", source: "research:case-study", pattern: "每3小时刷新红包，$0.12-0.91。需60秒内抢", tags: ["redpacket","timing"], detail: "高频轮询/api/red-packets，解析数学题" },
    { cat: "category_winrate", source: "research:40-day-run", pattern: "30次提交→6胜→20%胜率→赚$20.90。排名#236/51978", tags: ["benchmark","real-data"], detail: "前0.5%的agent。胜率20%即可赚钱" },
    { cat: "agent_competitor", source: "research:top-earners", pattern: "头部Agent月入$300-500。最高$487/47天", tags: ["earnings","benchmark"], detail: "质量>数量，深度1-2份提交胜率远超浅度3-5份" },
    { cat: "platform_tips", source: "research:platform-analysis", pattern: "AgentHansa日活1500，日赏金池$655。4000+注册agent", tags: ["market-size","competition"], detail: "1/3的agent活跃。需多平台并行弥补单平台任务量不足" },
    { cat: "lesson_learned", source: "self:daemon-development", pattern: "Daemon频繁重启导致0收益。需停止push让其运行", tags: ["deploy","stability"], detail: "每次push触发Render重启，daemon等不到首轮循环" },
    { cat: "lesson_learned", source: "self:remote-console", pattern: "正则替换server.js时吃掉了路由定义。永远用精确替换", tags: ["regex","bug"], detail: "用Edit工具精确替换，不用node -e进行复杂正则" },
    { cat: "response_template", source: "research:winning-format", pattern: "钩子(一句话+结果)→3-5数据点→完整报告(GitHub Gist链接)→Agent ID", tags: ["template","format"], detail: "这个格式在技术类Quest中胜率最高" },
    { cat: "market_observation", source: "research:show-me-the-money", pattern: "26个专项Skill+本地知识库>单一巨型daemon", tags: ["architecture","skill"], detail: "模块化Skill+知识积累是可扩展的正确架构" },
    { cat: "market_observation", source: "research:agent-economy", pattern: "AI Agent经济2026年:160M+x402交易，$50M+交易量，480K+agent", tags: ["market","x402"], detail: "Agent-to-Agent支付标准化推动自主经济闭环" },
    { cat: "compliance", source: "self:platform-rules", pattern: "17平台规则库是唯一护城河。竞品没有中国广告法+跨境合规", tags: ["moat","differentiation"], detail: "合规引擎+双语桥+物流数据=三重护城河" },
    { cat: "agent_market", source: "research:agent-selling", pattern: "Agent配置包可以卖$2.9-19.9。Coze+闲鱼渠道", tags: ["monetize","distribution"], detail: "先上闲鱼测试市场需求，再扩展Gumroad" },
  ];

  for (const s of seeds) {
    addAtom(s.cat, { source: s.source, pattern: s.pattern, tags: s.tags, detail: s.detail });
  }
  return stats();
}

function dashboard() {
  const s = stats();
  return [
    'KNOWLEDGE BASE DASHBOARD',
    'Atoms: ' + s.totalAtoms + ' | Categories: ' + Object.keys(s.byCategory).length,
    '',
    'A: ' + (s.byWork['A']||0) + ' | B: ' + (s.byWork['B']||0) + ' | C: ' + (s.byWork['C']||0),
    'D: ' + (s.byWork['D']||0) + ' | E: ' + (s.byWork['E']||0) + ' | F: ' + (s.byWork['F']||0) + ' | G: ' + (s.byWork['G']||0),
    '',
    'KB Called: ' + Object.values(usageLog).reduce((a,b)=>a+b,0) + ' times | ' + Object.keys(usageLog).length + ' categories used',
    'Top: ' + Object.entries(s.byCategory).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>k+':'+v).join(', ')
  ].join('\n');
}

module.exports = { CATEGORIES, addAtom, getAtoms, getByWork, search, getRelevantAtoms, stats, seed, dashboard, getUsage };

// CLI
if (require.main === module) {
  const cmd = process.argv[2] || "stats";
  if (cmd === "seed") {
    console.log("Seeding knowledge base...");
    const s = seed();
    console.log("Done. Total atoms:", s.totalAtoms);
  } else if (cmd === "stats") {
    console.log(JSON.stringify(stats(), null, 2));
  } else if (cmd === "search") {
    const q = process.argv[3] || "";
    console.log(JSON.stringify(search(q).slice(0, 5), null, 2));
  } else if (cmd === "work") {
    const w = process.argv[3] || "A";
    console.log(JSON.stringify(getByWork(w).slice(0, 5), null, 2));
  } else {
    console.log("Usage: node knowledge_base.js [seed|stats|search <q>|work <A-G>]");
  }
}
