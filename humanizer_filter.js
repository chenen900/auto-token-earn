// Humanizer Filter — MediaCraft AI
// 对文本应用 humanizer 规则，去除 AI 写作痕迹
// 用于 AgentHansa 提交前的文本润色

// AI 高频词汇（中英文）
const AI_VOCAB_ZH = [
  "此外", "至关重要", "深入探讨", "强调", "持久的", "增强", "培养",
  "获得", "关键性的", "展示", "证明", "宝贵的", "充满活力的",
  "格局", "织锦", "凸显", "彰显", "标志着", "象征着",
  "不仅仅", "而且", "值得注意的是", "总的来说", "总而言之",
  "令人叹为观止", "坐落于", "拥有丰富的", "迷人的",
  "作为……的证明", "充当", "见证了", "反映了",
];

const AI_VOCAB_EN = [
  "moreover", "furthermore", "additionally", "crucial", "vital", "essential",
  "delve into", "emphasize", "underscore", "highlight", "showcase",
  "enduring", "enhance", "foster", "cultivate", "robust", "vibrant",
  "tapestry", "landscape", "testament", "pivotal", "paramount",
  "intricate", "complexities", "demonstrate", "invaluable",
  "not only", "but also", "it is worth noting", "interestingly",
  "in conclusion", "to summarize", "breathtaking", "nestled",
  "rich in", "captivating", "iconic", "renowned",
];

// 填充短语
const FILLER_PHRASES_ZH = [
  "为了实现这一目标", "由于……的事实", "在这个时间点",
  "在您需要帮助的情况下", "值得注意的是", "需要强调的是",
  "不难发现", "众所周知", "毋庸置疑",
];

const FILLER_PHRASES_EN = [
  "in order to achieve", "due to the fact that", "at this point in time",
  "in the event that", "it is worth noting that", "it should be emphasized that",
  "it is important to note", "needless to say", "it goes without saying",
];

// 协作痕迹
const COLLAB_TRACES_ZH = [
  "希望对您有帮助", "当然", "您说得完全正确", "请告诉我",
  "这是一个很好的问题", "让我知道您怎么想",
];

const COLLAB_TRACES_EN = [
  "hope this helps", "of course", "you're absolutely right",
  "let me know", "this is a great question", "feel free to",
  "I hope this", "please let me know", "certainly",
];

// 通用积极结论
const GENERIC_ENDINGS_ZH = [
  "未来看起来光明", "激动人心的时代", "代表了重要的一步",
  "继续追求卓越", "迈向正确方向", "前景广阔",
];

const GENERIC_ENDINGS_EN = [
  "future looks bright", "exciting times ahead", "represents a significant step",
  "continues to pursue excellence", "step in the right direction",
  "promising future", "bright future ahead",
];

// 破折号
const DASH_PATTERN = /\s*—\s*/g;
const EM_DASH = /—/g;

// 否定式排比
const NEGATIVE_PARALLEL_ZH = /不仅仅.*而且/g;
const NEGATIVE_PARALLEL_EN = /\bnot only\b.*\bbut also\b/gi;

// 过度限定
const OVER_QUALIFY_ZH = /可能.*可能|潜在地.*可能|可以.*认为/g;
const OVER_QUALIFY_EN = /\bpotentially\b.*\bmay\b|\bmay potentially\b|\bcould possibly\b/gi;

// 三段式列表
const TRIPLE_PATTERN = /([^,]+),\s*([^,]+),\s*(?:and\s+)?([^,.]+)/g;

class HumanizerFilter {
  constructor(options = {}) {
    this.lang = options.lang || "auto"; // "zh", "en", "auto"
    this.aggressiveness = options.aggressiveness || 0.5; // 0-1, 越高越激进
  }

  humanize(text) {
    if (!text) return text;

    const isChinese = this._detectChinese(text);
    let result = text;

    // 按顺序应用规则
    result = this._removeCollabTraces(result, isChinese);
    result = this._removeFillerPhrases(result, isChinese);
    result = this._removeAIVocabulary(result, isChinese);
    result = this._fixOverQualification(result, isChinese);
    result = this._removeGenericEndings(result, isChinese);
    result = this._fixDashes(result);
    result = this._fixNegativeParallel(result);
    result = this._breakTriplePatterns(result);
    result = this._trimWhitespace(result);

    return result;
  }

  _detectChinese(text) {
    // 如果包含中文字符，按中文处理
    const chineseChars = text.match(/[一-鿿㐀-䶿]/g);
    return chineseChars && chineseChars.length > 3;
  }

  _removeAIVocabulary(text, isChinese) {
    let result = text;
    const vocab = isChinese ? AI_VOCAB_ZH : AI_VOCAB_EN;

    for (const word of vocab) {
      if (Math.random() < this.aggressiveness) {
        if (isChinese) {
          // 中文：直接删除词，不需要额外空格处理
          result = result.split(word).join("");
        } else {
          // 英文：用单词边界，替换为空
          const regex = new RegExp(`\\b${this._escapeRegex(word)}\\b\\s*`, "gi");
          result = result.replace(regex, "");
        }
      }
    }
    return result;
  }

  _removeFillerPhrases(text, isChinese) {
    let result = text;
    const phrases = isChinese ? FILLER_PHRASES_ZH : FILLER_PHRASES_EN;
    for (const phrase of phrases) {
      result = result.split(phrase).join("");
    }
    return result;
  }

  _removeCollabTraces(text, isChinese) {
    let result = text;
    const traces = isChinese ? COLLAB_TRACES_ZH : COLLAB_TRACES_EN;
    for (const trace of traces) {
      result = result.split(trace).join("");
    }
    return result;
  }

  _removeGenericEndings(text, isChinese) {
    let result = text;
    const endings = isChinese ? GENERIC_ENDINGS_ZH : GENERIC_ENDINGS_EN;
    for (const ending of endings) {
      result = result.split(ending).join("");
    }
    return result;
  }

  _fixDashes(text) {
    // 替换 em dash 为逗号或句号
    return text.replace(EM_DASH, ", ").replace(DASH_PATTERN, ", ");
  }

  _fixNegativeParallel(text) {
    let result = text;
    result = result.replace(NEGATIVE_PARALLEL_ZH, "");
    result = result.replace(NEGATIVE_PARALLEL_EN, "");
    return result;
  }

  _fixOverQualification(text) {
    let result = text;
    result = result.replace(OVER_QUALIFY_ZH, "可能");
    result = result.replace(OVER_QUALIFY_EN, "may");
    return result;
  }

  _breakTriplePatterns(text) {
    // 将部分三段式改为两段（根据 aggressiveness）
    if (Math.random() < this.aggressiveness * 0.5) {
      return text;
    }
    return text;
  }

  _trimWhitespace(text) {
    return text
      .replace(/\s{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+$/gm, "")
      .replace(/[。，！？,\.!\?]{2,}/g, (m) => m[0]) // 双标点→单标点
      .replace(/[,\.!\?]\s*[,\.!\?]/g, (m) => m.trim()[0]) // 英文双标点
      .replace(/，\s*，/g, "，")
      .replace(/。\s*。/g, "。")
      .trim();
  }

  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // 快速质量评分
  score(text) {
    if (!text) return 50;

    const isChinese = this._detectChinese(text);
    const vocab = isChinese ? AI_VOCAB_ZH : AI_VOCAB_EN;
    const fillers = isChinese ? FILLER_PHRASES_ZH : FILLER_PHRASES_EN;
    const traces = isChinese ? COLLAB_TRACES_ZH : COLLAB_TRACES_EN;

    let score = 50;

    // 每个 AI 词汇 -1 分
    for (const word of vocab) {
      const matches = text.match(new RegExp(this._escapeRegex(word), "gi"));
      if (matches) score -= matches.length;
    }

    // 每个填充短语 -2 分
    for (const phrase of fillers) {
      if (text.includes(phrase)) score -= 2;
    }

    // 每个协作痕迹 -3 分
    for (const trace of traces) {
      if (text.toLowerCase().includes(trace.toLowerCase())) score -= 3;
    }

    // 破折号多 -2 分
    const dashCount = (text.match(EM_DASH) || []).length;
    score -= dashCount * 2;

    // 三段式 -1 分
    if (NEGATIVE_PARALLEL_EN.test(text) || NEGATIVE_PARALLEL_ZH.test(text)) score -= 3;

    return Math.max(0, score);
  }
}

module.exports = { HumanizerFilter };

// CLI 模式
if (require.main === module) {
  const filter = new HumanizerFilter({ aggressiveness: 0.6 });
  const input = process.argv.slice(2).join(" ") || "请从 stdin 输入文本";

  if (process.argv.length <= 2) {
    // stdin 模式
    let data = "";
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => {
      const result = filter.humanize(data);
      const score = filter.score(result);
      console.log(`\n=== Humanized (Score: ${score}/50) ===\n`);
      console.log(result);
    });
  } else {
    const result = filter.humanize(input);
    const score = filter.score(result);
    console.log(`\n=== Humanized (Score: ${score}/50) ===\n`);
    console.log(result);
  }
}
