// 中国短视频/内容合规审查引擎
// 覆盖：广告法 + 平台规则 + 内容安全
// 用法: const result = reviewContent({ type: "script", text: "...", platform: "douyin" })

// ============ 广告法检查（9条核心禁令）============
const AD_LAW_CHECKS = [
  {
    id: "ad_law_9_1",
    rule: "禁止使用国家/国家机关名义",
    pattern: /国家(?:机关|部门|领导人|主席|总理|部委)|国务院|中央军委/,
    severity: "critical",
    suggestion: "删除涉及国家机关的表述",
  },
  {
    id: "ad_law_9_2",
    rule: "禁止使用绝对化用语",
    keywords: ["国家级", "世界级", "最高级", "最佳", "最好", "第一品牌", "顶级", "极品", "至尊", "独一无二", "绝无仅有", "万能", "100%有效", "零风险", "永久解决", "彻底根除"],
    severity: "high",
    suggestion: "将绝对化用语改为具体数据或事实描述",
  },
  {
    id: "ad_law_9_3",
    rule: "禁止妨碍社会安定、损害社会公共利益",
    pattern: /颠覆|推翻|暴乱|骚乱|动乱|社会不稳|制造恐慌/,
    severity: "critical",
    suggestion: "删除可能引发社会不安的表述",
  },
  {
    id: "ad_law_9_4",
    rule: "禁止淫秽、色情、赌博、迷信、恐怖、暴力内容",
    keywords: ["色情", "淫秽", "赌博", "博彩", "六合彩", "算命", "风水转运", "恐怖袭击", "暴力美学", "血腥"],
    pattern: /裸[体露]|性[交爱行为]|[赌博]博|风水改运/,
    severity: "critical",
    suggestion: "删除违规内容",
  },
  {
    id: "ad_law_17",
    rule: "禁止涉及疾病治疗功能（非药品/医疗器械/医疗服务广告）",
    pattern: /治疗|治愈|根除|康复|疗效|疗程|药效|主治|防治|防癌|抗癌|降[血压糖脂]|增强免疫力|排毒/,
    severity: "high",
    suggestion: "普通商品不得宣称疾病治疗功能，删除医疗相关表述",
  },
  {
    id: "ad_law_18",
    rule: "保健食品广告禁止含有表示功效的断言或保证",
    pattern: /保健|滋补|养生.*保证|肯定有效|吃了就|一[吃用]就|见效快|立竿见影|迅速见效/,
    severity: "high",
    suggestion: "保健品广告需标明'本品不能代替药物'，删除功效保证",
  },
  {
    id: "ad_law_20",
    rule: "禁止欺骗、误导消费者",
    keywords: ["虚假", "虚构", "捏造", "造假", "刷单", "刷量", "水军", "假评论", "假排名"],
    severity: "high",
    suggestion: "删除虚假/误导性内容，确保信息真实可验证",
  },
  {
    id: "ad_law_28",
    rule: "禁止使用不真实数据/统计/调查结果作为引证",
    pattern: /据[研究调查]|数据显示|统计表明|%的用户|%的人/,
    severity: "medium",
    suggestion: "引用数据需标注来源和有效期",
  },
  {
    id: "ad_law_38",
    rule: "禁止利用未成年人进行广告代言（特定品类）",
    pattern: /小朋友[说介绍]|学生[说介绍]|孩子[说介绍推荐]|宝宝[说用]|[0-9]+岁.*推荐/,
    severity: "high",
    suggestion: "不得使用未满10周岁未成年人作为广告代言人",
  },
];

// ============ 平台特定规则（从 JSON 数据库加载）============
const path = require("path");
const fs = require("fs");
const PLATFORM_RULES = JSON.parse(
  fs.readFileSync(path.join(__dirname, "platform-rules.json"), "utf-8")
).platforms;

// 将 JSON 中字符串 pattern 转为 RegExp
for (const key of Object.keys(PLATFORM_RULES)) {
  const pt = PLATFORM_RULES[key];
  if (pt.specialRules) {
    pt.specialRules.forEach((r) => {
      if (typeof r.pattern === "string" && r.pattern) r.pattern = new RegExp(r.pattern);
    });
  }
}

// ============ 通用内容安全检查 ============
const GENERAL_SAFETY_CHECKS = [
  { id: "political", label: "涉政敏感", severity: "critical", pattern: /taiwan.*independ|tibet.*independ|falun|六四|天安门|xi jinping|mao zedong/i },
  { id: "violence", label: "暴力血腥", severity: "critical", pattern: /杀[人死了]|血[腥淋]|暴[力行]|恐[怖惧]|炸[弹药]|枪[支击]/ },
  { id: "hate", label: "仇恨言论", severity: "critical", pattern: /歧视|种族|仇[恨视]|灭[绝族]|[种民]族[主优]/ },
  { id: "privacy", label: "隐私泄露", severity: "high", pattern: /身份证号|手机号.*1[3-9]\d{9}|银行卡号|\d{6}[一-龥]*\d{7,}/ },
  { id: "gambling", label: "赌博相关", severity: "critical", pattern: /[赌博]博|六合彩|时时彩|百家乐|赌[场注]/ },
  { id: "drug", label: "毒品相关", severity: "critical", pattern: /[吸毒]品|大麻|海洛因|冰毒|摇头丸|麻古/ },
];

// ============ 短视频专项检查 ============
const SHORT_VIDEO_CHECKS = {
  // 钩子检查（前3秒）
  hook: [
    { id: "hook_clickbait", label: "标题党", severity: "medium", pattern: /震惊[了]|看完[惊崩溃]|千万别|[没不]有人告诉|99%.*不知道|全网疯传|速看.*删/ },
    { id: "hook_mislead", label: "误导性钩子", severity: "high", pattern: /免费.*[领送拿]|限[时量].*抢|[最后剩].*天|马上.*[消失下架]/ },
  ],
  // 文案检查
  caption: [
    { id: "cap_emoji_spam", label: "表情符号滥用", severity: "low", maxEmoji: 15 },
    { id: "cap_hashtag_spam", label: "标签堆砌", severity: "low", maxHashtags: 10 },
    { id: "cap_too_short", label: "文案过短", severity: "info", minLength: 5 },
  ],
  // 口播检查
  voiceover: [
    { id: "vo_speed", label: "语速异常", severity: "info", suggestRange: "2-5字/秒" },
    { id: "vo_swear", label: "脏话/不文明用语", severity: "high", keywords: ["他妈", "操", "傻逼", "滚", "妈的", "放屁", "狗屁"] },
  ],
};

// ============ 主审查函数 ============

function reviewContent({ type = "script", text = "", platform = "douyin", options = {} }) {
  // Unicode 标准化，确保中文字符在不同环境下一致匹配
  const normalizedText = (text || "").normalize("NFC");
  const results = {
    passed: true,
    platform,
    type,
    timestamp: new Date().toISOString(),
    checks: [],
    summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    score: 100,
  };

  // 1. 通用安全审查
  for (const check of GENERAL_SAFETY_CHECKS) {
    if (check.pattern && check.pattern.test(normalizedText)) {
      results.checks.push({
        ...check,
        found: normalizedText.match(check.pattern)?.[0],
      });
      results.summary[check.severity]++;
      results.passed = false;
    }
  }

  // 2. 广告法审查
  for (const check of AD_LAW_CHECKS) {
    let found = false;
    let match = null;

    if (check.pattern) {
      match = normalizedText.match(check.pattern);
      found = !!match;
    }
    if (!found && check.keywords) {
      for (const kw of check.keywords) {
        if (normalizedText.includes(kw.normalize("NFC"))) {
          found = true;
          match = [kw];
          break;
        }
      }
    }

    if (found) {
      results.checks.push({
        id: check.id,
        rule: check.rule,
        severity: check.severity,
        found: match?.[0],
        suggestion: check.suggestion,
      });
      results.summary[check.severity]++;
      results.passed = false;
    }
  }

  // 3. 平台特定审查
  const pt = PLATFORM_RULES[platform];
  if (pt) {
    // 长度检查
    if (type === "title" && pt.maxTitleLength && normalizedText.length > pt.maxTitleLength) {
      results.checks.push({
        id: "platform_length_title",
        rule: `${pt.name}标题不超过${pt.maxTitleLength}字符`,
        severity: "medium",
        found: `当前${normalizedText.length}字符`,
        suggestion: `建议精简到${pt.maxTitleLength}字符以内`,
      });
      results.summary.medium++;
    }

    // 禁词检查
    if (pt.bannedKeywords) {
      for (const kw of pt.bannedKeywords) {
        if (normalizedText.toLowerCase().includes(kw.toLowerCase())) {
          results.checks.push({
            id: "platform_banned_word",
            rule: `${pt.name}平台禁用词: ${kw}`,
            severity: "high",
            found: kw,
            suggestion: `删除'${kw}'`,
          });
          results.summary.high++;
          results.passed = false;
        }
      }
    }

    // 特殊规则
    if (pt.specialRules) {
      for (const rule of pt.specialRules) {
        if (rule.pattern && rule.pattern.test(text)) {
          results.checks.push({
            id: "platform_special",
            rule: rule.rule,
            severity: "medium",
            found: normalizedText.match(rule.pattern)?.[0],
          });
          results.summary.medium++;
        }
        if (rule.keywords && rule.appliesTo === type) {
          for (const kw of rule.keywords) {
            if (normalizedText.includes(kw)) {
              results.checks.push({
                id: "platform_content_review",
                rule: rule.rule,
                severity: "low",
                found: kw,
                suggestion: "如为商业合作请添加#广告#标识",
              });
              results.summary.low++;
            }
          }
        }
      }
    }
  }

  // 4. 短视频专项检查
  if (type === "hook" || type === "script") {
    for (const check of SHORT_VIDEO_CHECKS.hook) {
      if (check.pattern && check.pattern.test(text)) {
        results.checks.push({ ...check, found: normalizedText.match(check.pattern)?.[0] });
        results.summary[check.severity]++;
      }
    }
  }

  if (type === "script" || type === "caption") {
    for (const check of SHORT_VIDEO_CHECKS.caption) {
      if (check.maxEmoji) {
        const emojiCount = (normalizedText.match(/[\uD800-\uDFFF]|[☀-⟿]|\ud83c[퀀-\udfff]|\ud83d[퀀-\udfff]|\ud83e[퀀-\udfff]/g) || []).length;
        if (emojiCount > check.maxEmoji) {
          results.checks.push({ ...check, found: `${emojiCount}个表情符号`, suggestion: `建议不超过${check.maxEmoji}个表情` });
          results.summary.low++;
        }
      }
      if (check.maxHashtags) {
        const hashtagCount = (normalizedText.match(/#/g) || []).length;
        if (hashtagCount > check.maxHashtags) {
          results.checks.push({ ...check, found: `${hashtagCount}个标签`, suggestion: `建议不超过${check.maxHashtags}个标签` });
          results.summary.low++;
        }
      }
    }
  }

  if (type === "voiceover") {
    for (const check of SHORT_VIDEO_CHECKS.voiceover) {
      if (check.keywords) {
        for (const kw of check.keywords) {
          if (normalizedText.includes(kw)) {
            results.checks.push({ ...check, found: kw });
            results.summary[check.severity]++;
            results.passed = false;
          }
        }
      }
    }
  }

  // 计算综合评分
  const deductions = results.summary.critical * 25 + results.summary.high * 10 + results.summary.medium * 3 + results.summary.low * 1;
  results.score = Math.max(0, 100 - deductions);
  results.passed = results.summary.critical === 0;

  // 汇总
  const total = results.summary.critical + results.summary.high + results.summary.medium + results.summary.low + results.summary.info;
  if (total === 0) {
    results.verdict = "✅ 内容合规，可安全发布";
  } else if (results.summary.critical > 0) {
    results.verdict = "⛔ 发现严重违规，禁止发布，需重新制作";
  } else if (results.summary.high >= 3) {
    results.verdict = "⚠️ 多项高危风险，建议修改后发布";
  } else {
    results.verdict = "🔍 存在部分风险，建议调整后发布";
  }

  return results;
}

// ============ 批量审查 ============

function reviewBatch(items) {
  return items.map((item) => ({
    ...reviewContent(item),
    id: item.id || null,
  }));
}

// ============ 审查报告生成 ============

function generateReport(reviewResult) {
  const r = reviewResult;
  let report = `# 内容合规审查报告\n\n`;
  report += `**平台：** ${r.platform}\n`;
  report += `**审查类型：** ${r.type}\n`;
  report += `**审查时间：** ${r.timestamp}\n`;
  report += `**合规评分：** ${r.score}/100\n`;
  report += `**判定：** ${r.verdict}\n\n`;
  report += `---\n\n`;
  report += `## 问题汇总\n\n`;
  report += `| 严重程度 | 数量 |\n|---------|------|\n`;
  report += `| Critical | ${r.summary.critical} |\n`;
  report += `| High | ${r.summary.high} |\n`;
  report += `| Medium | ${r.summary.medium} |\n`;
  report += `| Low | ${r.summary.low} |\n\n`;
  report += `---\n\n`;
  report += `## 详细问题\n\n`;
  for (const check of r.checks) {
    report += `### [${check.severity.toUpperCase()}] ${check.rule || check.label}\n`;
    report += `- **发现：** ${check.found || "N/A"}\n`;
    if (check.suggestion) report += `- **建议：** ${check.suggestion}\n`;
    report += `\n`;
  }
  return report;
}

module.exports = { reviewContent, reviewBatch, generateReport, PLATFORM_RULES, AD_LAW_CHECKS };
