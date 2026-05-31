# MediaCraft AI 搬家指南

> 2026-05-31 | 目标：新电脑一键恢复全部工作线

---

## 拷贝清单（从旧电脑复制这些到新电脑）

### 必拷（缺一不可）

```
d:\ai赚钱体系\                          → 整个项目根目录
  ├── auto-token-earn\                   ★ 核心：daemon + x402 API + 数据
  ├── dashboard.html                     ★ 总控台
  ├── GOVERNANCE.md                      操作总纲
  ├── MIGRATION.md                       本文件
  ├── POSTMORTEM.md                      （在 auto-token-earn/ 里）
  ├── agent-marketplace\                 Agent 模板
  ├── opinion-warfare\                   舆论战
  ├── learning-diagnostic\               AI 家教
  ├── research\                          知识库 + CashClaw + SMTM
  ├── reverse-cut\                       逆向剪辑
  └── spendos\                           SpendOS

C:\Users\xinchuan\.claude\
  ├── CLAUDE.md                          全局规则
  └── projects\d--ai----\memory\         项目记忆
      ├── MEMORY.md
      ├── project_status.md
      └── *.md
```

### 可选（有就拷）

```
C:\Users\xinchuan\.claude\settings.json           Claude Code 配置
d:\ai赚钱体系\.env                                 环境变量
d:\ai赚钱体系\auto-token-earn\.env                 项目环境变量
```

---

## 新电脑上要做的

### 1. 放文件
把整个 `d:\ai赚钱体系\` 放到新电脑同一路径（或改路径后更新 CLAUDE.md 引用）。
把 `.claude\` 下的文件放到新电脑 `C:\Users\<新用户名>\.claude\`。

### 2. 安装依赖
```bash
cd d:\ai赚钱体系\auto-token-earn
npm install
```

### 3. 设置 Git
```bash
git config --global user.email "1577465307@qq.com"
git config --global user.name "chenen900"
cd d:\ai赚钱体系\auto-token-earn
git remote set-url origin https://github.com/chenen900/auto-token-earn.git
```

### 4. 需要手动更新路径的文件
如果新电脑路径不同，改 `C:\Users\xinchuan\.claude\projects\d--ai----\memory\MEMORY.md` 里的路径。

---

## 当前状态速查（给 Claude Code 读的）

### 工作线 a-l 进度

| 线 | 项目 | 完成 | 核心交付 |
|----|------|:--:|------|
| a | Agent 自动赚钱 | 4/6 | Daemon 稳定运行，维护模式 |
| b | 跨境电商工具箱 | 8/10 | 工具箱 200 OK |
| c | API 挂牌 | 8/26 | the402 + 4 GitHub PRs |
| d | Agent 贩卖 | 4/8 | 4 个模板 + 分镜知识库 |
| e | 舆论战 | 0/1 | 框架已建 |
| f | Z-1 归档 | ✅ | 基础设施已完成 |
| g | AI 家教 | 1/7 | 设计文档 |
| h | Wiki KB | 1/4 | Docker + schema |
| i | REVERSE-CUT | 5/9 | Python 全链 |
| j | SpendOS | 1/3 | 已克隆 |
| k | CashClaw | 1/2 | npm v1.7.0 |
| l | SMTM | 1/2 | npm v2.5.1 |

### 关键账号

| 平台 | 账号 | 凭证 |
|------|------|------|
| GitHub | chenen900 | token: `ghp_...` — 从 git remote URL 中提取 |
| AgentHansa | MediaCraft AI | API key: tabb_RbsUoEipzInRhm2-D2QoH5WHjyYrKJeb9Ff5TUCmx8E |
| AgentHansa | agent ID | a3a607a4-670f-4e7c-b848-27c0e83833f0 |
| the402 | 1577465307@qq.com | API key: sk_d9929a3963474877a01ee228ba89b499 |
| Twitter | @binghanchen2 / My AI Clerk | (浏览器已登录) |
| Reddit | @Diligent_Motor6906 | (浏览器已登录) |
| Solana 收款 | 8ZqmcWARgGjZzJLzqwquG8GTvDb39RFbTWKqhShqbtht | Phantom |
| Base 收款 | 0x4445212f0C20EBAfCe3923fB16178cB04a8329ad | Phantom |
| the402 Wallet | 0x593ac69eb7020bcc37ca6c642110a97d8121bdb0 | CDP Smart Account |

### 线上服务

| 服务 | URL | 状态 |
|------|-----|:--:|
| x402 API | https://mediacraft-x402-api.onrender.com | 在线 |
| Daemon 监控 | /daemon/status | 维护模式 |
| the402 服务 | svc_1aadaadfdf494625 | 在线 |
| GitHub 仓库 | github.com/chenen900/auto-token-earn | master |

### Daemon 运行模式

- 当前：**maintenance**（只做日常：签到/认知/论坛/Arena，不投标模板）
- $30+ quest 自动转发到 `/daemon/quest-queue` 等待人工写内容
- 切换命令：`curl -X POST /daemon/mode -d '{"mode":"active"}'`
- 保活：GitHub Actions 每 8 分钟 ping `/daemon/health`

### GitHub PRs 状态

| # | 仓库 | Stars | PR |
|---|------|:-----:|:--:|
| c.8 | public-apis/public-apis | 438K | #6183 open |
| c.9 | punkpeye/awesome-mcp-servers | 88K | #7102 open |
| c.10 | e2b-dev/awesome-ai-agents | 27K | #1028 open |
| c.11 | best-of-ai/ai-directories | — | #321 open |

### 重要经验（给未来的 Claude Code）

1. **永不信任 status 端点的数字**——必须用真实 API 验证
2. **AgentHansa check-in 会改格式**——需持续监控 solveMath 解析器
3. **每次 push 都杀 daemon 进程**——修改后必须验证线上运行
4. **详见 GOVERNANCE.md**——操作总纲，所有验证流程
5. **详见 POSTMORTEM.md**——5 天零收益事故复盘
