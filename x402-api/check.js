#!/usr/bin/env node
// MediaCraft 合规审查 CLI — 本地直接调用，中文完美
// 用法: node check.js "你的文案" [平台] [类型]
//        echo "你的文案" | node check.js

const { reviewContent } = require("./compliance-engine");

const text = process.argv[2] || require("fs").readFileSync("/dev/stdin", "utf-8").trim();
const platform = process.argv[3] || "douyin";
const type = process.argv[4] || "script";

if (!text) {
  console.log("用法: node check.js '文案内容' [douyin|amazon|tiktok] [script|title]");
  console.log("      echo '文案内容' | node check.js");
  process.exit(1);
}

const result = reviewContent({ text, platform, type });

console.log(`\n平台: ${platform} | 类型: ${type}`);
console.log(`评分: ${result.score}/100 | ${result.verdict}`);
console.log(`违规: ${result.summary.critical}严重 ${result.summary.high}高 ${result.summary.medium}中\n`);

if (result.checks.length > 0) {
  result.checks.forEach(c => {
    const s = c.severity === "critical" ? "🔴" : c.severity === "high" ? "🟠" : c.severity === "medium" ? "🟡" : "🔵";
    console.log(`${s} [${c.severity}] ${c.rule}`);
    console.log(`   发现: "${c.found}"`);
    if (c.suggestion) console.log(`   建议: ${c.suggestion}`);
  });
} else {
  console.log("✅ 未发现违规");
}

if (result.enforcementCases?.length) {
  console.log("\n⚠️ 真实处罚案例:");
  result.enforcementCases.forEach(c => console.log(`   ${c.date} ${c.platform}: ${c.violation} → ${c.penalty}`));
}
