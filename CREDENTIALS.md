# 账号与密钥记录

> 创建时间：2026-05-25
> 此文件包含所有平台账号信息和 API 密钥的索引（密钥本体存在 .env）

---

## AgentHansa

| 项目 | 值 |
|------|-----|
| Agent 名称 | MediaCraft AI |
| Agent ID | MediaCraft_AI |
| 个人页面 | agenthansa.com/agents/MediaCraft_AI |
| API Key | 已存 .env（AGENTHANSA_API_KEY） |
| 等级 | Lv.1 Dormant（Junge / The Newcomer） |
| 钱包类型 | FluxA |
| FluxA Agent ID | 1eade7a5-91a5-40ed-900b-bb323eb8f070 |
| Solana 地址 | 8ZqmcWARgGjZzJLzqwquG8GTvDb39RFbTWKqhShqbtht |
| 注册奖励 | $0.05 |
| 最低提现 | $1.00 |

---

## FluxA 钱包

| 项目 | 值 |
|------|-----|
| Agent ID | 1eade7a5-91a5-40ed-900b-bb323eb8f070 |
| Agent 名称 | MediaCraft_AI |
| 授权链接 | https://agentwallet.fluxapay.xyz/add-agent?agentId=1eade7a5-91a5-40ed-900b-bb323eb8f070&name=MediaCraft_AI |
| 操作员钱包 | 0xe291702Cd96c2a00294bC0828C0C0e153d3b9007 |
| 状态 | ✅ 已授权 |
| 备注 | Embedded wallet 显示 not found，待后续处理 |

---

## Phantom 钱包

| 项目 | 值 |
|------|-----|
| Solana 地址 | 8ZqmcWARgGjZzJLzqwquG8GTvDb39RFbTWKqhShqbtht |
| 浏览器 | Edge |
| 状态 | ✅ 已安装 |

---

## 环境变量文件

路径：`auto-token-earn/.env`

```
AGENTHANSA_API_KEY=tabb_RbsUoEipzInRhm2-D2QoH5WHjyYrKJeb9Ff5TUCmx8E
SOLANA_WALLET=8ZqmcWARgGjZzJLzqwquG8GTvDb39RFbTWKqhShqbtht
FLUXA_AGENT_ID=1eade7a5-91a5-40ed-900b-bb323eb8f070
```

---

## Phase 0 完成清单

- [x] Phantom 钱包安装
- [x] AgentHansa 注册
- [x] API Key 保存
- [x] FluxA 初始化和授权
- [ ] **待完成：在 AgentHansa Wallet 面板填入 FluxA Agent ID**
- [ ] **待完成：每日签到（Check In）**
