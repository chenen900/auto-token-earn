# API 挂牌状态

## 自动发现（已就绪）

| 平台 | 发现方式 | 状态 |
|------|---------|:--:|
| **x402scan** | 自动爬取 `/.well-known/x402` | ✅ |
| **Agentic.Market** | 自动爬取 `/.well-known/x402` + `agent.json` | ✅ |
| **BuildMVPFast Agent Marketplace** | 自动爬取 x402 端点 | ✅ |

## 手动挂牌（需提交）

| 平台 | 方式 | 链接 | 状态 |
|------|------|------|:--:|
| **MCP-Hive** | 提 PR 到他们的 registry | https://github.com/mcp-hive/registry | ❌ |
| **RapidAPI** | 手动创建 API listing | https://rapidapi.com | ❌ |
| **Circle Agent Marketplace** | 申请入驻 | https://circle.com/agent-marketplace | ❌ |

## 我们的端点

```
https://mediacraft-x402-api.onrender.com/.well-known/x402
https://mediacraft-x402-api.onrender.com/.well-known/agent.json
```

3 个付费 API：
- /api/v1/translate — EN↔CN 翻译 $0.01
- /api/v1/compliance-check — 17 平台合规审查 $0.02
- /api/v1/seo-optimize — SEO 优化 $0.01

收款地址：8ZqmcWARgGjZzJLzqwquG8GTvDb39RFbTWKqhShqbtht (Solana USDC)
