#!/usr/bin/env node
// mediacraft-check — AI 内容合规审查 CLI
// 用法: npx mediacraft-check "文本" --platform douyin --type script

var API = process.env.MEDIACRAFT_API || "https://mediacraft-x402-api.onrender.com";

var args = process.argv.slice(2);
var text = null;
var platform = "douyin";
var type = "script";
var jsonMode = false;

// 解析参数
for (var i = 0; i < args.length; i++) {
  if (args[i] === "--platform" || args[i] === "-p") { platform = args[++i]; }
  else if (args[i] === "--type" || args[i] === "-t") { type = args[++i]; }
  else if (args[i] === "--json") { jsonMode = true; }
  else if (args[i] === "--help" || args[i] === "-h") { showHelp(); process.exit(0); }
  else if (!text && !args[i].startsWith("-")) { text = args[i]; }
}

// 从管道读入
if (!text && !process.stdin.isTTY) {
  var chunks = [];
  process.stdin.setEncoding("utf-8");
  process.stdin.on("readable", function () {
    var chunk;
    while ((chunk = process.stdin.read()) !== null) chunks.push(chunk);
  });
  process.stdin.on("end", function () {
    run(chunks.join("").trim());
  });
} else if (!text) {
  showHelp();
  process.exit(1);
} else {
  run(text);
}

function showHelp() {
  console.log("MediaCraft AI — 内容合规审查 CLI");
  console.log("");
  console.log("用法:");
  console.log("  npx mediacraft-check \"你的文本\" [选项]");
  console.log("  echo \"你的文本\" | npx mediacraft-check [选项]");
  console.log("");
  console.log("选项:");
  console.log("  -p, --platform    平台: douyin/bilibili/xiaohongshu/tiktok/youtube (默认: douyin)");
  console.log("  -t, --type        类型: script/hook/caption/voiceover/title (默认: script)");
  console.log("  --json            JSON 格式输出");
  console.log("  -h, --help        帮助");
  console.log("");
  console.log("示例:");
  console.log("  npx mediacraft-check \"国家级最好的产品，加微信私聊\" --platform douyin");
  console.log("  cat script.txt | npx mediacraft-check --platform tiktok");
  console.log("");
  console.log("升级到付费 API: https://mediacraft-x402-api.onrender.com");
}

function run(text) {
  if (!text || text.length < 2) {
    console.error("错误: 文本太短");
    process.exit(1);
  }

  var body = JSON.stringify({ text: text, platform: platform, type: type });
  var opts = {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
  };

  var proto = API.startsWith("https") ? require("https") : require("http");
  var req = proto.request(API + "/api/v1/compliance-check", opts, function (res) {
    var d = "";
    res.on("data", function (c) { d += c; });
    res.on("end", function () {
      try {
        var r = JSON.parse(d);
        if (jsonMode) {
          console.log(JSON.stringify(r, null, 2));
        } else {
          printResult(r);
        }
        process.exit(r.passed ? 0 : 1);
      } catch (e) {
        console.error("API 错误: " + d.substring(0, 200));
        process.exit(2);
      }
    });
  });

  req.on("error", function (e) {
    console.error("网络错误: " + e.message);
    process.exit(2);
  });

  req.write(body);
  req.end();
}

function printResult(r) {
  var icon = {
    critical: "⛔",
    high: "🔴",
    medium: "🟡",
    low: "⚪",
    info: "ℹ️",
  };

  console.log("");
  console.log("╔════════════════════════════════════╗");
  console.log("║  MediaCraft AI  合规审查报告      ║");
  console.log("╠════════════════════════════════════╣");
  console.log("║  平台: " + pad(r.platform || "?", 26) + "║");
  console.log("║  类型: " + pad(r.type || "?", 26) + "║");
  console.log("║  评分: " + pad(String(r.score || 0) + "/100", 24) + "║");
  console.log("║  判定: " + pad(r.verdict || "?", 26) + "║");
  console.log("╠════════════════════════════════════╣");

  if (r.checks && r.checks.length > 0) {
    var shown = 0;
    r.checks.forEach(function (c) {
      if (shown < 10) {
        var label = (icon[c.severity] || "") + " [" + (c.severity || "?").toUpperCase() + "] " + (c.rule || c.label || "?");
        console.log("║  " + label.substring(0, 33));
        if (c.found) console.log("║    → 发现: " + c.found.substring(0, 26));
        if (c.suggestion) console.log("║    → 建议: " + c.suggestion.substring(0, 26));
        shown++;
      }
    });
    if (r.checks.length > 10) console.log("║  ... 还有 " + (r.checks.length - 10) + " 项");
  } else {
    console.log("║  ✅ 未发现问题                      ║");
  }

  console.log("╠════════════════════════════════════╣");
  console.log("║  升级付费API: mediacraft-x402      ║");
  console.log("╚════════════════════════════════════╝");
  console.log("");
}

function pad(s, len) {
  var str = String(s);
  while (str.length < len) str += " ";
  return str;
}
