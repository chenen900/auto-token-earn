// Quality Gate — 投标前自评引擎
// 每笔提交前检查：是否"对口"？是否太泛？是否值得投？
const fs = require("fs");
const path = require("path");

// ====== AI 味检测词（与 humanizer 同步） ======
const AI_SMELL_WORDS = [
  "moreover", "furthermore", "additionally", "crucial", "vital", "essential",
  "delve into", "emphasize", "underscore", "highlight", "showcase",
  "enduring", "enhance", "foster", "robust", "vibrant", "tapestry", "landscape",
  "testament", "pivotal", "paramount",
  "此外", "至关重要", "深入探讨", "强调", "格局", "织锦", "凸显", "彰显", "标志着"
];

// ====== 空壳响应模式（检测"说了跟没说一样"） ======
const HOLLOW_PATTERNS = [
  /Let me break this down systematically/i,
  /Here['']s my approach/i,
  /I['']ll approach this systematically/i,
  /I['']d approach this in three phases/i,
  /Let me trace through the logic/i,
  /Content strategy:/i,
  /Writing approach:/i,
  /Career strategy:/i,
  /Research methodology:/i,
  /Product evaluation framework:/i,
];

// ====== 主评分函数 ======
function assess(questTitle, questDescription, response, category) {
  const checks = [];
  let score = 0;
  const maxScore = 100;

  // 1. 具体性检查：回复是否提到了 quest 中的具体内容？(30分)
  const titleWords = extractKeywords(questTitle || "");
  const descWords = extractKeywords(questDescription || "");
  const allQuestWords = [...new Set([...titleWords, ...descWords])];

  let matchedKeywords = 0;
  const responseLower = (response || "").toLowerCase();
  for (const word of allQuestWords) {
    if (word.length >= 4 && responseLower.includes(word)) {
      matchedKeywords++;
    }
  }

  const specificityScore = allQuestWords.length > 0
    ? Math.min(30, Math.round(matchedKeywords / Math.max(3, allQuestWords.length) * 30))
    : 15; // 如果 quest 没有描述文字，给中等分

  checks.push({
    check: "specificity",
    label: "回复是否针对具体任务？",
    score: specificityScore,
    max: 30,
    detail: `关键词命中: ${matchedKeywords}/${allQuestWords.length}`
  });
  score += specificityScore;

  // 2. 空洞检查：是否只是泛泛而谈？（25分）
  let hollowCount = 0;
  for (const pattern of HOLLOW_PATTERNS) {
    if (pattern.test(response || "")) hollowCount++;
  }
  const hollowPenalty = Math.min(25, hollowCount * 8);
  const hollowScore = 25 - hollowPenalty;
  checks.push({
    check: "hollow",
    label: "是否空洞套话？",
    score: hollowScore,
    max: 25,
    detail: `检测到 ${hollowCount} 个套话模式`
  });
  score += hollowScore;

  // 3. AI 味检测（15分）
  let aiSmellCount = 0;
  for (const word of AI_SMELL_WORDS) {
    if ((response || "").toLowerCase().includes(word.toLowerCase())) aiSmellCount++;
  }
  const aiPenalty = Math.min(15, aiSmellCount * 2);
  const aiScore = 15 - aiPenalty;
  checks.push({
    check: "ai_smell",
    label: "AI 味检测",
    score: aiScore,
    max: 15,
    detail: `AI词汇: ${aiSmellCount} 个`
  });
  score += aiScore;

  // 4. 长度合理性（15分）
  const respLen = (response || "").length;
  let lengthScore = 0;
  if (respLen >= 800) lengthScore = 15;
  else if (respLen >= 500) lengthScore = 12;
  else if (respLen >= 300) lengthScore = 8;
  else if (respLen >= 150) lengthScore = 4;
  else lengthScore = 0;

  checks.push({
    check: "length",
    label: "回复长度",
    score: lengthScore,
    max: 15,
    detail: `${respLen} 字符`
  });
  score += lengthScore;

  // 5. 结构完整性（15分）
  let structureScore = 0;
  if (/##/.test(response || "")) structureScore += 5;          // 有标题
  if (/\d+\./.test(response || "")) structureScore += 3;       // 有编号
  if (/\*/.test(response || "")) structureScore += 2;          // 有强调
  if (/```/.test(response || "")) structureScore += 3;         // 有代码块（技术类加分）
  if (response && response.length > 50 && response.split("\n").length >= 3) structureScore += 2;  // 多段落

  checks.push({
    check: "structure",
    label: "结构完整性",
    score: Math.min(15, structureScore),
    max: 15,
    detail: `结构分: ${structureScore}`
  });
  score += Math.min(15, structureScore);

  // ====== 决策 ======
  // 高赏金任务降低门槛
  const reward = parseFloat(questDescription) || 0;
  const threshold = 40; // 基础通过线

  const passed = score >= threshold;
  const warnings = checks.filter(c => c.score < c.max * 0.4).map(c => c.label);

  return {
    score: Math.min(100, score),
    maxScore,
    passed,
    threshold,
    checks,
    warnings,
    recommendation: passed
      ? (score >= 70 ? "strong_submit" : "conditional_submit")
      : "skip"
  };
}

// ====== 辅助：提取有意义的英文关键词 ======
function extractKeywords(text) {
  if (!text) return [];
  // 分词，过滤短词和停用词
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "and", "but", "or",
    "nor", "not", "so", "yet", "both", "either", "neither", "each", "every",
    "all", "any", "few", "more", "most", "other", "some", "such", "only",
    "own", "same", "than", "too", "very", "just", "that", "this", "these",
    "those", "what", "which", "who", "whom", "how", "when", "where", "why",
    "about", "also", "its", "it", "i", "you", "he", "she", "they", "we",
    "me", "him", "her", "them", "us", "my", "your", "his", "their", "our"
  ]);

  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));

  return [...new Set(words)];
}

// ====== 批量评估 ======
function assessBatch(questsWithResponses) {
  return questsWithResponses.map(({ questId, title, description, response, category, reward }) => {
    const result = assess(title, description, response, category);
    return { questId, title, reward, ...result };
  });
}

module.exports = { assess, assessBatch, extractKeywords };
