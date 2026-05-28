// AI Listing Generator — MediaCraft AI
// 输入中文产品信息 → 输出完整英文 Amazon Listing
// 核心付费功能：会员 ¥9.9/月

const { reviewContent } = require("./compliance-engine");

// ========== 产品类别模板 ==========
const CATEGORY_TEMPLATES = {
  electronics: {
    name: "电子",
    titleFormat: "{brand} {product} — {feature1}, {feature2}",
    bulletAngles: ["性能", "兼容性", "便携性", "续航", "材质"],
    descriptionIntro: "Experience the difference with {brand}'s {product}. Engineered for {target}, this {product} delivers exceptional performance and reliability.",
  },
  home: {
    name: "家居",
    titleFormat: "{brand} {product} — {style} Design, Perfect for {room}",
    bulletAngles: ["材质", "设计", "尺寸", "易用性", "耐用性"],
    descriptionIntro: "Transform your {room} with {brand}'s {product}. Combining {style} aesthetics with practical functionality.",
  },
  fashion: {
    name: "服装",
    titleFormat: "{brand} {product} — {style}, {material}, Perfect for {occasion}",
    bulletAngles: ["材质面料", "版型剪裁", "适用场景", "护理方式", "尺码指南"],
    descriptionIntro: "Make a statement with {brand}'s {product}. Crafted from premium {material}, designed for {target} who value both style and comfort.",
  },
  beauty: {
    name: "美妆",
    titleFormat: "{brand} {product} — {benefit}, {skinType} Skin, {size}",
    bulletAngles: ["功效成分", "适用肤质", "使用方法", "质地感受", "安全认证"],
    descriptionIntro: "Reveal your best skin with {brand}'s {product}. Formulated with {benefit} ingredients for visible results.",
  },
  sports: {
    name: "运动",
    titleFormat: "{brand} {product} — {feature1}, {feature2}, {durability}",
    bulletAngles: ["性能表现", "舒适度", "耐用性", "适用运动", "便携收纳"],
    descriptionIntro: "Push your limits with {brand}'s {product}. Built for {target} who demand the best in performance and durability.",
  },
  toys: {
    name: "玩具",
    titleFormat: "{brand} {product} — {ageRange} Kids, {educational}, {material}",
    bulletAngles: ["教育价值", "安全性", "适龄范围", "互动方式", "材质"],
    descriptionIntro: "Spark creativity with {brand}'s {product}. Designed for children {ageRange}, combining fun with {educational} learning.",
  },
  general: {
    name: "通用",
    titleFormat: "{brand} {product} — {feature1}, {feature2}, {feature3}",
    bulletAngles: ["核心功能", "质量材质", "使用场景", "差异化优势", "售后保障"],
    descriptionIntro: "Discover {brand}'s {product} — the perfect solution for {target}. Quality craftsmanship meets innovative design.",
  },
};

// ========== 关键词库（产品特征 → 英文卖点词） ==========
const FEATURE_TRANSLATIONS = {
  "防水": { en: "Waterproof", bullets: ["IPX7 waterproof rating — use in rain, shower, or pool without worry", "Sealed construction protects against water damage in any condition"] },
  "蓝牙": { en: "Bluetooth", bullets: ["Bluetooth 5.3 technology for stable, low-latency wireless connection", "Quick pairing with all your devices — phone, tablet, laptop"] },
  "便携": { en: "Portable", bullets: ["Ultra-compact design fits easily in your pocket or bag", "Lightweight at just {weight}g — take it anywhere"] },
  "续航": { en: "Long Battery Life", bullets: ["{hours} hours of continuous use on a single charge", "Quick-charge technology: 10 minutes of charging = 2 hours of use"] },
  "不锈钢": { en: "Stainless Steel", bullets: ["Premium 304 stainless steel — rust-resistant and built to last", "Dishwasher safe for effortless cleaning"] },
  "环保": { en: "Eco-Friendly", bullets: ["Made from sustainable, BPA-free materials", "100% recyclable packaging — we care about the planet"] },
  "静音": { en: "Ultra-Quiet", bullets: ["Whisper-quiet operation at just {noise}dB — won't disturb your sleep or work", "Advanced noise reduction technology for peaceful environments"] },
  "速干": { en: "Quick-Dry", bullets: ["Moisture-wicking fabric dries in minutes, not hours", "Stay comfortable all day — perfect for workouts and outdoor activities"] },
  "高清": { en: "HD/High Definition", bullets: ["Crystal-clear {resolution} resolution for stunning visual detail", "Advanced lens technology captures every moment with professional clarity"] },
  "抗菌": { en: "Antibacterial", bullets: ["Built-in antimicrobial protection inhibits 99.9% of bacteria growth", "Keeps your {product} fresh and hygienic between washes"] },
};

// ========== 搜索词库（按类别） ==========
const SEARCH_TERMS = {
  electronics: ["gadget", "tech accessories", "electronic device", "smart", "wireless", "USB", "rechargeable", "digital"],
  home: ["home decor", "kitchen gadget", "household essential", "organizer", "decoration", "storage", "modern"],
  fashion: ["clothing", "apparel", "outfit", "wear", "trendy", "casual", "formal", "seasonal"],
  beauty: ["skincare", "cosmetics", "beauty tool", "makeup", "facial", "anti-aging", "natural", "organic"],
  sports: ["fitness", "workout gear", "outdoor equipment", "training", "exercise", "athletic", "camping", "hiking"],
  toys: ["educational toy", "kids gift", "learning game", "puzzle", "creative play", "STEM", "preschool"],
};

// ========== 生成引擎 ==========

function generateListing({ brand, product, features, specs, category, targetAudience, platform }) {
  const cat = CATEGORY_TEMPLATES[category] || CATEGORY_TEMPLATES.general;
  const kw = SEARCH_TERMS[category] || SEARCH_TERMS.electronics;

  // 解析中文 features
  const featureList = (features || "").split(/[\n,，、]+/).filter(Boolean).map(f => f.trim());

  // 生成标题
  const title = buildTitle(brand, product, featureList, cat, specs);

  // 生成五点描述
  const bullets = buildBullets(product, featureList, cat, specs);

  // 生成产品描述
  const description = buildDescription(brand, product, featureList, cat, specs, targetAudience);

  // 生成搜索词
  const searchTerms = buildSearchTerms(brand, product, category, featureList, kw);

  // 合规审查
  const complianceCheck = reviewContent({
    type: "title",
    text: title + " " + bullets.join(" ") + " " + description,
    platform: platform || "amazon",
  });

  // SEO 评分
  const seoScore = scoreSEO(title, bullets, description, searchTerms, featureList);

  return {
    platform: platform || "amazon",
    category: cat.name,
    listing: {
      title,
      titleLength: title.length,
      titleMax: platform === "amazon" ? 200 : 80,
      bullets,
      description,
      searchTerms: searchTerms.join(", "),
    },
    compliance: {
      score: complianceCheck.score,
      passed: complianceCheck.passed,
      issues: complianceCheck.checks.map(c => ({ severity: c.severity, rule: c.rule || c.label, suggestion: c.suggestion })),
    },
    seo: seoScore,
    version: "1.0",
    generatedAt: new Date().toISOString(),
  };
}

function buildTitle(brand, product, features, cat, specs) {
  const feature1 = features[1] || features[0] || "High Quality";
  const feature2 = features[2] || features[0] || "Premium";

  // Translate simple Chinese features to English
  const f1 = translateSimple(feature1);
  const f2 = translateSimple(feature2);
  const prod = translateSimple(product || "Product");

  const title = `${brand || "Brand"} ${prod} — ${f1}, ${f2}`;
  return title.substring(0, 200);
}

function buildBullets(product, features, cat, specs) {
  const bullets = [];
  const productName = translateSimple(product || "product");

  // 1. 核心卖点
  const mainFeature = features[0] || "Premium quality";
  bullets.push(`[${translateSimple(mainFeature).toUpperCase()}] Engineered with advanced ${translateSimple(mainFeature).toLowerCase()} technology, our ${productName} delivers superior performance that outperforms the competition.`);

  // 2. 品质材质
  bullets.push(`[PREMIUM MATERIALS] Crafted from high-grade, durable materials that ensure long-lasting use. Every ${productName} undergoes rigorous quality testing before shipping.`);

  // 3-5. 基于输入特征
  const remaining = features.slice(1, 5);
  const angles = ["[EASY TO USE]", "[PERFECT GIFT]", "[VERSATILE]", "[WHAT YOU GET]", "[SATISFACTION GUARANTEED]"];
  for (let i = 0; i < remaining.length && bullets.length < 5; i++) {
    const f = translateSimple(remaining[i]);
    const angle = angles[i] || "[FEATURE]";
    bullets.push(`${angle} ${f} — designed with you in mind. ${generateBenefitText(productName, f)}`);
  }

  // Fill up to 5
  while (bullets.length < 5) {
    const a = angles[bullets.length] || "[PREMIUM QUALITY]";
    bullets.push(`${a} We stand behind our ${productName}. If you're not completely satisfied, we offer a full refund — no questions asked.`);
  }

  return bullets.slice(0, 5).map(b => b.substring(0, 500));
}

function buildDescription(brand, product, features, cat, specs, target) {
  const productName = translateSimple(product || "product");
  const brandName = brand || "Our";
  const targetAudience = target || "everyone";

  let desc = `<p>${brandName}'s ${productName} is designed for ${targetAudience} who demand quality and reliability. `;

  const featureList = features.slice(0, 4);
  desc += `Featuring ${featureList.map(f => translateSimple(f).toLowerCase()).join(", ")} — this is the complete package.</p>`;

  desc += `<p><b>Why Choose ${brandName} ${productName}?</b></p><ul>`;
  for (const f of featureList.slice(0, 4)) {
    desc += `<li><b>${translateSimple(f)}:</b> ${generateBenefitText(productName, translateSimple(f))}</li>`;
  }
  desc += "</ul>";

  desc += `<p><b>Specifications:</b> ${specs || "See product images for detailed specifications."}</p>`;
  desc += `<p>Add to cart now and experience the ${brandName} difference!</p>`;

  return desc.substring(0, 2000);
}

function buildSearchTerms(brand, product, category, features, baseTerms) {
  const terms = new Set(baseTerms.slice(0, 8));
  terms.add((brand || "").toLowerCase());
  terms.add(translateSimple(product || "").toLowerCase());
  for (const f of features.slice(0, 5)) {
    const t = translateSimple(f).toLowerCase();
    terms.add(t);
    terms.add(t.replace(/ /g, ""));
  }
  return [...terms].filter(Boolean).slice(0, 20);
}

function scoreSEO(title, bullets, description, searchTerms, features) {
  let score = 70;

  // Title length check
  if (title.length >= 80 && title.length <= 200) score += 10;
  else if (title.length < 60) score -= 10;

  // Bullet count
  if (bullets.length === 5) score += 5;
  else score -= 5 * (5 - bullets.length);

  // Description length
  if (description.length > 500) score += 5;
  if (description.length > 1500) score -= 5;

  // Keyword usage
  const fullText = title + " " + bullets.join(" ") + " " + description;
  let kwCount = 0;
  for (const term of searchTerms) {
    if (fullText.toLowerCase().includes(term.toLowerCase())) kwCount++;
  }
  score += Math.min(kwCount * 2, 10);

  // Features count
  score += Math.min(features.length * 2, 5);

  return {
    score: Math.min(100, Math.max(0, score)),
    breakdown: {
      title: title.length >= 80 && title.length <= 200 ? "good" : "needs work",
      bullets: bullets.length === 5 ? "complete" : `${bullets.length}/5`,
      description: description.length > 500 ? "detailed" : "too short",
      keywords: `${kwCount} search terms incorporated`,
    },
  };
}

function translateSimple(text) {
  // Basic CN→EN translation for common terms
  const map = {
    "防水": "Waterproof", "蓝牙": "Bluetooth", "便携": "Portable",
    "续航": "Long Battery Life", "不锈钢": "Stainless Steel",
    "环保": "Eco-Friendly", "静音": "Ultra-Quiet", "速干": "Quick-Dry",
    "高清": "High Definition", "抗菌": "Antibacterial", "智能": "Smart",
    "充电": "Rechargeable", "无线": "Wireless", "迷你": "Mini",
    "多功能": "Multi-Function", "大容量": "Large Capacity",
    "保温": "Insulated", "耐用": "Durable", "轻便": "Lightweight",
    "易清洗": "Easy Clean", "折叠": "Foldable", "可调节": "Adjustable",
    "防滑": "Non-Slip", "透气": "Breathable", "柔软": "Soft",
    "舒适": "Comfortable", "时尚": "Stylish", "经典": "Classic",
    "音箱": "Speaker", "耳机": "Headphones", "充电器": "Charger",
    "杯子": "Cup", "灯": "Lamp", "收纳": "Organizer",
    "工具": "Tool", "套装": "Set", "支架": "Stand",
    "服装": "Clothing", "鞋子": "Shoes", "包": "Bag",
    "护肤品": "Skincare", "化妆品": "Cosmetics",
  };
  return map[text] || text;
}

function generateBenefitText(product, feature) {
  const benefits = [
    `Enjoy the difference that quality makes — your ${product} will exceed expectations.`,
    `Designed to make your life easier and more enjoyable every day.`,
    `Experience professional-grade results right at home.`,
    `Built to last — this is an investment in quality you'll appreciate for years.`,
    `Save time and effort while getting better results than ever before.`,
  ];
  return benefits[Math.floor(Math.random() * benefits.length)];
}

module.exports = { generateListing, CATEGORY_TEMPLATES };
