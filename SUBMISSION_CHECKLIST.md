# 工作c 提交清单 — 逐平台操作指南

> 更新：2026-05-29 | API 在线 ✅ | OpenAPI spec 就绪 ✅

---

## c.4 RapidAPI（最大平台，35M+ 开发者）

**链接**: https://rapidapi.com/ → Add API
**佣金**: 20-25%
**耗时**: 10 min

### 提交表单填写

| 字段 | 填写内容 |
|------|---------|
| **API Name** | MediaCraft AI — Cross-Border Content Intelligence |
| **Category** | AI / Machine Learning |
| **Description** | Bilingual (EN↔CN) content compliance, translation, and SEO optimization. Checks content against Chinese Advertising Law + 17 platform rules (Douyin, Bilibili, Xiaohongshu, TikTok, YouTube, Amazon, etc.). Pay-per-call via x402 protocol. Built by agents, for agents. |
| **Base URL** | `https://mediacraft-x402-api.onrender.com` |
| **OpenAPI Spec** | 上传 `x402-api/openapi-3.0.json` |
| **Pricing** | Freemium: first 10 calls free, then $0.01-$0.05/call via x402 (Solana USDC) |
| **Website** | `https://mediacraft-x402-api.onrender.com/toolbox` |
| **GitHub** | `https://github.com/xinchuan/auto-token-earn` |
| **Tags** | compliance, translation, seo, chinese, ecommerce, advertising-law, x402 |

### 核心卖点（Unique Value Proposition）
> "The only API checking your content against China's Advertising Law + 17 platform-specific rules, with real penalty case references (¥45K-870K fines)."

---

## c.5 AgenticTrade（MCP-native，10% 佣金）

**链接**: https://agentictrade.com → List API
**耗时**: 5 min
**材料已就绪**: smithery.yaml + server.json + .mcp.json

| 字段 | 内容 |
|------|------|
| API Endpoint | `https://mediacraft-x402-api.onrender.com` |
| Protocol | x402 + MCP stdio |
| Pricing | $0.01-0.05/call USDC |
| Wallet | `8ZqmcWARgGjZzJLzqwquG8GTvDb39RFbTWKqhShqbtht` |

---

## c.7 the402.ai / Circle（0% 佣金！）

**链接**: https://the402.ai → Submit API
**耗时**: 5 min

| 字段 | 内容 |
|------|------|
| API Name | MediaCraft AI |
| Category | Content / Compliance |
| Endpoint | `https://mediacraft-x402-api.onrender.com/.well-known/x402` |
| Pricing | $0.01-0.05 USDC/call, first 10 free |
| Description | Chinese content compliance + EN↔CN translation + SEO |

---

## c.8 public-apis/public-apis PR（426K stars）

**操作步骤**（浏览器，5 min）：
1. 打开 https://github.com/public-apis/public-apis
2. Fork → 自动在你的账户下创建 fork
3. 在 fork 里打开 `README.md` → 点铅笔编辑
4. 找到 `### Machine Learning` 分类，添加：

```markdown
| [MediaCraft AI](https://mediacraft-x402-api.onrender.com) | Chinese content compliance check against Advertising Law + 17 platform rules (Douyin, Bilibili, Xiaohongshu, etc.), EN↔CN translation, and SEO optimization. Pay-per-call via x402 (Solana USDC). | `apiKey` | Yes | Yes |
```

5. 提交 PR: 标题 `Add MediaCraft AI — Chinese Compliance & Translation API`
6. 描述: `Pay-per-call AI API for Chinese content compliance (17 platforms), bilingual translation, and SEO optimization. First 10 calls free.`

---

## c.9 punkpeye/awesome-mcp-servers PR（84K stars）

1. Fork: https://github.com/punkpeye/awesome-mcp-servers
2. 编辑 README.md，找到 `### Content & Writing` 分类，添加：

```markdown
- [MediaCraft AI](https://github.com/xinchuan/auto-token-earn) — 中文内容合规审查（中国广告法 + 17平台规则）+ EN↔CN 翻译 + SEO 优化。支持 x402 微支付。含 smithery.yaml + server.json + MCP stdio server。
```

3. PR 标题: `Add MediaCraft AI — Compliance + Translation + SEO MCP Server`

---

## c.10 e2b-dev/awesome-ai-agents PR（27K stars）

1. Fork: https://github.com/e2b-dev/awesome-ai-agents
2. 找到 `### Developer Tools`，添加：

```markdown
- [MediaCraft AI](https://mediacraft-x402-api.onrender.com) — AI agent for Chinese content compliance (17 platforms), EN↔CN translation, and SEO optimization. x402 pay-per-call protocol.
```

3. PR 标题: `Add MediaCraft AI — Multi-tool compliance & translation agent`

---

## c.11 best-of-ai/ai-directories PR

1. Fork: https://github.com/best-of-ai/ai-directories
2. 添加：

```markdown
| MediaCraft AI | Compliance, Translation, SEO | Chinese content compliance + EN↔CN translation + SEO | [Website](https://mediacraft-x402-api.onrender.com) | Paid (per-call) |
```

3. PR 标题: `Add MediaCraft AI — Compliance API for China Market`

---

## 提交顺序建议

按 ROI 从高到低：
1. **the402.ai** (c.7) — 0% 佣金，5 分钟，最快变现
2. **AgenticTrade** (c.5) — MCP-native，材料已齐
3. **RapidAPI** (c.4) — 最大平台，已备好 OpenAPI spec
4. **GitHub PRs** (c.8-c.11) — 最长尾 SEO 价值，各 5 分钟

> 全部手动提交预计总耗时：约 40 分钟
