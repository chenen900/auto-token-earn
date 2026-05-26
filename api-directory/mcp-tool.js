#!/usr/bin/env node
// API Directory MCP Tool — AI Agent 离线查 API 目录
// 用法: Claude/Cursor MCP 配置指向此文件

var fs = require("fs");
var path = require("path");

var DIR = JSON.parse(fs.readFileSync(path.join(__dirname, "directory.json"), "utf-8"));

process.stdin.setEncoding("utf-8");
var buf = "";
process.stdin.on("data", function (c) {
  buf += c;
  while (buf.includes("\n")) {
    var nl = buf.indexOf("\n");
    var line = buf.substring(0, nl);
    buf = buf.substring(nl + 1);
    if (!line.trim()) continue;
    try { var msg = JSON.parse(line); handle(msg); } catch (e) {}
  }
});

function send(r) { process.stdout.write(JSON.stringify(r) + "\n"); }

function handle(msg) {
  var id = msg.id, m = msg.method, p = msg.params || {};

  if (m === "initialize") return send({ jsonrpc: "2.0", id: id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "api-directory", version: DIR.version } } });

  if (m === "tools/list") return send({ jsonrpc: "2.0", id: id, result: { tools: [
    { name: "search_apis", description: "搜索 API 目录。输入关键词查找可用的免费/付费 API。返回名称、URL、价格、认证方式。", inputSchema: { type: "object", properties: { query: { type: "string", description: "搜索关键词，如 weather, translation, crypto" }, category: { type: "string", description: "可选: ai-services, data, dev-tools, ecommerce, finance, utility" } }, required: ["query"] } },
    { name: "list_categories", description: "列出所有 API 类别", inputSchema: { type: "object", properties: {} } },
    { name: "get_featured", description: "获取推荐/精选 API 列表", inputSchema: { type: "object", properties: {} } }
  ] } });

  if (m === "tools/call") {
    var name = p.name, args = p.arguments || {};
    var result = "";

    if (name === "search_apis") {
      var q = (args.query || "").toLowerCase();
      var cat = args.category;
      var found = DIR.apis.filter(function (a) {
        if (cat && a.category !== cat) return false;
        var txt = (a.name + " " + a.tags.join(" ") + " " + a.description).toLowerCase();
        return txt.includes(q);
      }).slice(0, 10);
      result = JSON.stringify({ query: q, count: found.length, results: found.map(function (a) { return { name: a.name, url: a.url, method: a.method, price: a.price, auth: a.auth, description: a.description.substring(0, 100) }; }) }, null, 2);
    }

    if (name === "list_categories") {
      result = JSON.stringify(DIR.categories, null, 2);
    }

    if (name === "get_featured") {
      var feat = DIR.apis.filter(function (a) { return a.featured; });
      result = JSON.stringify({ featured: feat.map(function (a) { return { name: a.name, url: a.url, price: a.price, description: a.description }; }) }, null, 2);
    }

    return send({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: result }] } });
  }
}
