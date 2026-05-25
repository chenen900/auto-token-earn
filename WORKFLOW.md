# 执行工作流

> 每个 Phase 逐步推进，完成一个再进下一个。每步向你确认。

---

## Phase 0：基础设施准备（需要你手动操作）

### 你需要做的事：

**1. 创建加密钱包**
- 安装 Phantom 钱包（Solana + Base 兼容）
- 备份助记词
- 这是收 USDC 的"银行账户"

**2. 注册平台账号（我帮你填表，你去点确认）**
- AgentHansa：agenthansa.com → 注册 Agent
- ClawGig：clawgig.ai/for-agents → 注册 Agent
- dealwork.ai：注册 Agent

**3. 获取 API Key**
- 每个平台注册后会发 API Key
- 把 Key 存到本项目的 `.env` 文件

---

## Phase 1：AgentHansa 主力线（目标：$10-16/天）

| 步骤 | 内容 | 产出 |
|------|------|------|
| 1.1 | 注册 + API 对接 | 可调用 API |
| 1.2 | 编写自动化脚本：每日签到 + 日常任务 + 任务拉取 + 筛选 + 提交 | `agent_hansa_worker.py` |
| 1.3 | 编写任务分析器：判断哪些 Quest 我们能做、ROI 预估 | 内置于 worker |
| 1.4 | 编写内容生成器：根据 Quest 要求自动生成提交内容 | 内置于 worker |
| 1.5 | 部署定时运行（cron / 计划任务） | 全自动运转 |
| 1.6 | 运行 7 天，收集数据，优化策略 | 数据报告 |

---

## Phase 2：ClawGig + dealwork.ai 副线（目标：$2-5/天）

| 步骤 | 内容 | 产出 |
|------|------|------|
| 2.1 | 注册 + API 对接 | API Key |
| 2.2 | 编写 Gig 轮询 + 自动投标脚本 | `clawgig_worker.py` |
| 2.3 | dealwork.ai 服务挂牌 | 服务列表 |
| 2.4 | 部署定时运行 | 全自动 |

---

## Phase 3：x402 付费 API 长线（目标：被动收入）

| 步骤 | 内容 | 产出 |
|------|------|------|
| 3.1 | 确定 API 产品（翻译 / 文案 / SEO / 脚本） | 产品清单 |
| 3.2 | 搭建 API 服务 + x402 支付中间件 | 可调用 API |
| 3.3 | 部署到 VPS（$6/月 Fly.io 或 Railway） | 上线 |
| 3.4 | 挂牌到 x402 Bazaar / Agentic.Market / MuleRun | 多平台分发 |
| 3.5 | 写 MCP manifest 让 Claude/Cursor 可发现 | 生态接入 |

---

## Phase 4：监控与优化

| 步骤 | 内容 | 产出 |
|------|------|------|
| 4.1 | 每日收益仪表板 | dashboard |
| 4.2 | ROI 分析：哪个平台/任务类型最赚 | 优化策略 |
| 4.3 | 自动调参：调整投标价格、任务筛选阈值 | 自动化 |

---

## 我们需要用到的 AI Agent 团队

| Agent | 角色 | 用途 |
|-------|------|------|
| Content Creator | 内容创作 | 写 Quest 提交、写 API 返回内容 |
| Language Translator | 翻译 | 中英互译任务 |
| SEO Specialist | SEO | 标题/描述优化任务 |
| Social Media Strategist | 社交文案 | 营销/Twitter 类任务 |
| Analytics Reporter | 数据分析 | 收益报表、ROI 分析 |
| Legal Compliance Checker | 合规 | 确保产出符合平台规则 |
| Agents Orchestrator | 编排 | 自动化管线调度 |

---

## 下一步

准备好了吗？我们从 **Phase 0** 开始——先确认你要做的事情：
1. 安装 Phantom 钱包
2. 准备好接收我来帮你填注册表单

告诉我说"开始 Phase 0"，我们就动工。
