# API 挂牌状态

> 更新：2026-05-29 | 挂牌材料已就绪 | 变现平台材料已备好 | 详见 SUBMISSION_CHECKLIST.md

## 自动发现（已生效 ✅）

| # | 平台 | 方式 |
|---|------|------|
| 1 | **x402scan** | `/.well-known/x402` 自动爬取 |
| 2 | **Agentic.Market** | `/.well-known/x402` + `agent.json` |
| 3 | **BuildMVPFast** | x402 端点自动发现 |

## 挂牌材料（已就绪 ✅）

| 文件 | 用途 |
|------|------|
| `smithery.yaml` | Smithery 自动发现配置 |
| `x402-api/server.json` | 官方 MCP Registry 清单 |
| `x402-api/package.json` | npm 发布元数据（增强版） |
| `x402-api/.mcp.json` | MCP 工具声明 |
| `MCP_LISTING_GUIDE.md` | 8 个平台手动提交指南 |

## 待手动提交（📋 材料齐全，逐平台操作）

| # | 平台 | 提交方式 | 耗时 |
|---|------|---------|:--:|
| 4 | **mcp.so** | 网页表单 → `https://mcp.so` | 1 min |
| 5 | **Smithery** | 连接 GitHub → `https://smithery.ai/new` | 3 min |
| 6 | **PulseMCP** | 官方注册表自动同步 | 0 |
| 7 | **Glama** | GitHub 自动索引 | 0 |
| 8 | **LobeHub** | 自动索引 | 0 |
| 9 | **MCP Marketplace** | 网页注册 | 5 min |
| 10 | **MCPize** | 网页注册 | 5 min |
| 11 | **AgenticTrade** | 网页注册 | 5 min |

> 注：MCP-Hive（mcp-hive.com）当前不可达，已从清单移除。新增 5 个平台替代。

## API 端点

```
https://mediacraft-x402-api.onrender.com/.well-known/x402
https://mediacraft-x402-api.onrender.com/.well-known/agent.json
```

| API | 价格 |
|-----|:---:|
| /api/v1/translate — EN↔CN 翻译 | $0.01 |
| /api/v1/compliance-check — 17 平台合规审查 | $0.02 |
| /api/v1/seo-optimize — SEO 优化 | $0.01 |

收款：`8ZqmcWARgGjZzJLzqwquG8GTvDb39RFbTWKqhShqbtht` (Solana USDC)

---

## 2026-05-29 推进成果

| 交付物 | 用途 | 状态 |
|--------|------|:--:|
| `x402-api/openapi-3.0.json` | RapidAPI 提交用 OpenAPI 3.0 规范（19 个端点） | ✅ |
| `SUBMISSION_CHECKLIST.md` | c.4-c.11 逐平台操作指南（8 个平台） | ✅ |

### 待浏览器手动提交（材料已备齐）

| # | 平台 | 佣金 | 耗时 | 指南 |
|---|------|:--:|:--:|------|
| c.4 | RapidAPI | 20-25% | 10 min | 上传 openapi-3.0.json |
| c.5 | AgenticTrade | 10% | 5 min | MCP 材料已就绪 |
| c.7 | the402.ai | **0%** | 5 min | 最高优先级 |
| c.8 | public-apis PR | — | 5 min | Fork + 加条目 |
| c.9 | awesome-mcp-servers PR | — | 5 min | Fork + 加条目 |
| c.10 | awesome-ai-agents PR | — | 5 min | Fork + 加条目 |
| c.11 | ai-directories PR | — | 5 min | Fork + 加条目 |

> 提交顺序：c.7 → c.5 → c.4 → c.8-c.11 | 预计总耗时 ~40 分钟
