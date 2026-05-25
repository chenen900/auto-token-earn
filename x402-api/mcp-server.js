#!/usr/bin/env node
// MediaCraft AI — MCP Server
// 让 Claude / Cursor / Copilot 直接调用我们的付费 API
// 用法: npx @modelcontextprotocol/inspector node mcp-server.js
// 或在 Claude Code 中配置为 MCP Server

const API_BASE = process.env.MEDIACRAFT_API_URL || "https://mediacraft-x402-api.onrender.com";

async function callApi(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// MCP JSON-RPC 协议处理
process.stdin.setEncoding("utf-8");

let buffer = "";

process.stdin.on("data", async (chunk) => {
  buffer += chunk;

  // 尝试解析完整的 JSON-RPC 消息
  while (buffer.includes("\n")) {
    const newlineIdx = buffer.indexOf("\n");
    const line = buffer.substring(0, newlineIdx);
    buffer = buffer.substring(newlineIdx + 1);

    if (!line.trim()) continue;

    try {
      const msg = JSON.parse(line);
      const response = await handleMessage(msg);
      if (response) {
        process.stdout.write(JSON.stringify(response) + "\n");
      }
    } catch (e) {
      process.stderr.write(`MCP Error: ${e.message}\n`);
    }
  }
});

async function handleMessage(msg) {
  const { id, method, params } = msg;

  // 初始化握手
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: "mediacraft-ai",
          version: "1.0.0",
        },
      },
    };
  }

  // 工具列表
  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "compliance_check",
            description: "审查内容是否符合中国广告法及平台规则。支持抖音/B站/小红书/TikTok/YouTube。检查类型: script(脚本), hook(钩子), caption(文案), voiceover(口播), title(标题)。",
            inputSchema: {
              type: "object",
              properties: {
                text: { type: "string", description: "要审查的文本内容" },
                platform: { type: "string", enum: ["douyin", "bilibili", "xiaohongshu", "tiktok", "youtube"], description: "目标平台" },
                type: { type: "string", enum: ["script", "hook", "caption", "voiceover", "title"], description: "内容类型" },
              },
              required: ["text"],
            },
          },
          {
            name: "translate",
            description: "中英互译。支持 en→zh 和 zh→en。",
            inputSchema: {
              type: "object",
              properties: {
                text: { type: "string", description: "要翻译的文本" },
                from: { type: "string", enum: ["en", "zh"], description: "源语言" },
                to: { type: "string", enum: ["en", "zh"], description: "目标语言" },
              },
              required: ["text"],
            },
          },
          {
            name: "seo_optimize",
            description: "SEO 标题/描述/关键词优化。支持 YouTube/B站/抖音/TikTok/Medium。",
            inputSchema: {
              type: "object",
              properties: {
                title: { type: "string", description: "标题" },
                description: { type: "string", description: "描述" },
                keywords: { type: "array", items: { type: "string" }, description: "关键词列表" },
                platform: { type: "string", enum: ["youtube", "bilibili", "douyin", "tiktok", "medium"], description: "平台" },
              },
              required: ["title"],
            },
          },
          {
            name: "compliance_report",
            description: "生成正式的合规审查报告（可用于执法出示）。",
            inputSchema: {
              type: "object",
              properties: {
                text: { type: "string", description: "要审查的文本内容" },
                platform: { type: "string", description: "目标平台" },
                type: { type: "string", description: "内容类型" },
              },
              required: ["text"],
            },
          },
        ],
      },
    };
  }

  // 工具调用
  if (method === "tools/call") {
    const { name, arguments: args } = params;

    try {
      let result;
      switch (name) {
        case "compliance_check":
          result = await callApi("/api/v1/compliance-check", {
            text: args.text,
            platform: args.platform || "douyin",
            type: args.type || "script",
          });
          break;
        case "translate":
          result = await callApi("/api/v1/translate", {
            text: args.text,
            from: args.from || "en",
            to: args.to || "zh",
          });
          break;
        case "seo_optimize":
          result = await callApi("/api/v1/seo-optimize", {
            title: args.title,
            description: args.description || "",
            keywords: args.keywords || [],
            platform: args.platform || "youtube",
          });
          break;
        case "compliance_report":
          result = await callApi("/api/v1/compliance-report", {
            text: args.text,
            platform: args.platform || "douyin",
            type: args.type || "script",
          });
          break;
        default:
          return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${name}` } };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
      };
    } catch (e) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message: e.message },
      };
    }
  }

  // 未知方法
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } };
}
