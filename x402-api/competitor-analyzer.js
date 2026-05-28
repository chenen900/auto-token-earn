// Competitor ASIN Analyzer — MediaCraft AI
// 专业版核心功能（¥29.9/月）：分析竞品Listing，找出关键词策略和弱点
const { reviewContent } = require("./compliance-engine");

function analyzeCompetitor({ asin, title, bullets, description, category, platform }) {
  const cat = category || "general";
  const plat = platform || "amazon";

  // 1. 合规分析
  const complianceResult = reviewContent({
    type: "title",
    text: (title || "") + " " + (bullets || []).join(" ") + " " + (description || ""),
    platform: plat,
  });

  // 2. 关键词策略分析
  const keywords = extractKeywords(title || "", bullets || [], description || "");
  const keywordGaps = findKeywordGaps(keywords, cat);

  // 3. Listing 评分
  const listingScore = scoreCompetitorListing(title, bullets, description, plat);

  // 4. 我们的差异化建议
  const differentiation = generateDifferentiation(keywords, keywordGaps, cat);

  return {
    asin: asin || "unknown",
    platform: plat,
    category: cat,
    analyzed: new Date().toISOString(),

    listingQuality: {
      titleScore: listingScore.title,
      bulletsScore: listingScore.bullets,
      descriptionScore: listingScore.description,
      overallScore: listingScore.overall,
      verdict: listingScore.overall >= 80 ? "强" : listingScore.overall >= 60 ? "中等" : "弱",
    },

    compliance: {
      score: complianceResult.score,
      issues: complianceResult.checks.map(c => ({
        severity: c.severity,
        rule: c.rule || c.label,
        found: c.found,
        suggestion: c.suggestion,
      })),
      riskLevel: complianceResult.score >= 90 ? "低风险" : complianceResult.score >= 70 ? "中风险" : "高风险",
    },

    keywordStrategy: {
      found: keywords.slice(0, 15),
      missing: keywordGaps.slice(0, 10),
      density: {
        strong: keywords.filter(k => (title||"").toLowerCase().includes(k.toLowerCase())).length,
        titleCount: keywords.filter(k => (title||"").toLowerCase().includes(k.toLowerCase())).length,
        bulletCount: (bullets||[]).reduce((s, b) => s + keywords.filter(k => b.toLowerCase().includes(k.toLowerCase())).length, 0),
      },
    },

    strengths: listingScore.strengths,
    weaknesses: listingScore.weaknesses,
    differentiation: differentiation,
    actionPlan: generateActionPlan(listingScore, complianceResult, keywordGaps),
  };
}

function extractKeywords(title, bullets, description) {
  const text = [title, ...(bullets||[]), description].join(" ").toLowerCase();
  const commonWords = new Set(["the","a","an","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","can","shall","to","of","in","for","on","with","at","by","from","as","into","through","during","before","after","above","below","between","and","but","or","nor","not","so","yet","both","either","neither","each","every","all","any","few","more","most","other","some","such","no","only","own","same","this","that","these","those","it","its","very","just","than","too","also","now"]);

  const words = text.split(/[\s,.;:!?()\[\]{}"'-]+/).filter(w => w.length > 2 && !commonWords.has(w));
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(e => e[0]);
}

function findKeywordGaps(found, category) {
  const categoryKeywords = {
    electronics: ["wireless","bluetooth","portable","rechargeable","waterproof","fast charging","USB-C","noise cancelling","long battery","compact"],
    home: ["organizer","storage","space saving","durable","easy clean","modern","minimalist","decor","aesthetic"],
    fashion: ["breathable","lightweight","stylish","casual","formal","summer","winter","cotton","linen"],
    beauty: ["natural","organic","moisturizing","anti-aging","vitamin","serum","hypoallergenic","cruelty-free","paraben-free"],
    sports: ["durable","lightweight","waterproof","adjustable","non-slip","ergonomic","portable","heavy duty"],
    toys: ["educational","STEM","creative","preschool","puzzle","interactive","safe","non-toxic","learning"],
    general: ["premium","quality","durable","versatile","gift","professional","easy use","portable","lightweight"],
  };
  const target = (categoryKeywords[category] || categoryKeywords.general);
  return target.filter(k => !found.includes(k) && !found.some(f => f.includes(k)));
}

function scoreCompetitorListing(title, bullets, description, platform) {
  const result = { title: 70, bullets: 70, description: 70, overall: 70, strengths: [], weaknesses: [] };

  if (!title || title.length < 60) {
    result.title -= 15;
    result.weaknesses.push("标题过短（<60字符），关键词覆盖不足");
  } else if (title.length > 200) {
    result.title -= 10;
    result.weaknesses.push("标题过长（>" + (platform === "amazon" ? 200 : 80) + "字符），可能被截断");
  } else {
    result.title += 15;
    result.strengths.push("标题长度合理，关键词覆盖充足");
  }

  if (!bullets || bullets.length < 5) {
    result.bullets -= 15;
    result.weaknesses.push(`五点描述不完整（${bullets ? bullets.length : 0}/5），缺少卖点展示`);
  } else {
    result.bullets += 10;
    const longBullets = bullets.filter(b => b.length > 200).length;
    if (longBullets >= 3) {
      result.bullets += 10;
      result.strengths.push("五点描述详细丰富（" + longBullets + "/5条超过200字符）");
    }
  }

  if (!description || description.length < 300) {
    result.description -= 20;
    result.weaknesses.push("产品描述过短（<300字符），搜索引擎权重低");
  } else if (description.length > 1500) {
    result.description += 15;
    result.strengths.push("产品描述详尽（" + description.length + "字符），SEO友好");
  }

  result.overall = Math.round((result.title + result.bullets + result.description) / 3);
  return result;
}

function generateDifferentiation(keywords, gaps, category) {
  return {
    summary: "竞品未覆盖以下高价值关键词，你可以直接抢占",
    quickWins: gaps.slice(0, 5).map(k => ({
      keyword: k,
      action: `在标题和五点中加入"${k}"`,
      expectedImpact: "提升搜索排名和点击率",
    })),
    avoidKeywords: keywords.filter(k => {
      const risky = ["best","#1","guaranteed","100%","cure","treat","medical"];
      return risky.some(r => k.includes(r));
    }).map(k => ({
      keyword: k,
      risk: "此词可能违反广告法或平台规则",
      suggestion: "竞品在用但你不该用——合规风险高",
    })),
  };
}

function generateActionPlan(score, compliance, gaps) {
  const plan = [];

  if (compliance.score < 90) {
    plan.push({ priority: "高", action: "修正合规问题", detail: `竞品有 ${compliance.issues.length} 个合规风险点，你在Listing中避免这些问题就能获得优势` });
  }
  if (score.title < 70) {
    plan.push({ priority: "高", action: "优化标题", detail: "竞品标题较弱，你在标题中嵌入 " + gaps.slice(0, 3).join("、") + " 等关键词可直接超越" });
  }
  if (score.bullets < 70) {
    plan.push({ priority: "中", action: "完善五点描述", detail: "写满5条，每条200+字符，覆盖竞品没提到的卖点" });
  }
  if (score.description < 70) {
    plan.push({ priority: "中", action: "丰富产品描述", detail: "写800-1500字符的A+级别描述，包含品牌故事+使用场景+规格参数" });
  }
  plan.push({ priority: "低", action: "差异化定价", detail: "基于竞品价格区间，选择高于均价（做品质）或低于均价（做性价比）的定位" });

  return plan;
}

module.exports = { analyzeCompetitor };
