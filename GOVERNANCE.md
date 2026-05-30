# MediaCraft AI 操作总纲 — 验证优先原则

> 2026-05-31 制定。本文件是对"5 天零收益事故"的制度性回应。
> 适用范围：所有工作线（a-l）。所有代码改动、部署、API 对接均须遵守。

---

## 零、诊断思维的逻辑铁律

### 铁律 1：找到一个根因 ≠ 找到所有根因

当一个系统**长期静默失败**时，每一个与外部交互的模块都是独立的故障点。找到第一个 bug 后，必须追问：

```
"这个 bug 让系统崩了 X 天。在这 X 天里，还有哪些模块也依赖外部 API？
 那些 API 是否也变了？是否也被同样的静默崩溃模式影响了？"
```

**案例**：投标 bug 修了，签到 bug 没查 → 5 天签到全部失败 → 账号 spam → 额外损失。

### 铁律 2：画依赖拓扑图

排查之前，列出**所有**外部依赖，逐一验证：

```
系统有哪些外部交互点？
├── AgentHansa API
│   ├── /agents/checkin          ← 签到
│   ├── /agents/checkin/verify   ← 签到验证
│   ├── /agents/cognitive-challenge ← 认知挑战
│   ├── /agents/me               ← 账号状态
│   ├── /forum                   ← 论坛
│   ├── /forum/{id}/comments     ← 评论
│   ├── /help/agent-feed         ← Help Request
│   ├── /alliance-war/quests/    ← Quest 投标
│   └── /arena/                  ← Arena
├── the402 API
│   └── /v1/participants/{id}    ← Webhook
├── Render
│   └── 内存/超时限制
└── GitHub Actions
    └── keepalive 是否在跑
```

找一个 bug 后，**必须遍历所有其他节点**——不是"可能也坏了"，而是"假设全都坏了，逐一排除"。

### 铁律 3：反向验证

不验证"我们觉得应该怎么样"，而是验证"实际发生了什么"。

| 错误思维 | 正确思维 |
|---------|---------|
| "errors: 0，说明没 bug" | "errors: 0 是因为 try-catch 吞了。让我看 AgentHansa 那边有没有收到我们的请求" |
| "submissionsToday: 0，说明没 Quest" | "让我 curl AgentHansa inbox 看真的有 Quest 吗" |
| "签到我写了对的代码" | "让我 curl 一次签到 API 看返回格式是否和代码匹配" |

### 铁律 4：每次外部 API 更新都是潜在断裂点

第三方 API（AgentHansa、the402）随时可能改格式。代码中的 API 调用不是"写对一次就永远对"。每次排查故障时，**假设 API 可能已经变了**，用 curl 重新确认。

---

## 核心原则

**信任但验证。永远不信任 status 端点的数字。**

status 端点只反映"我们写了什么代码来报告"，不反映"系统实际发生了什么"。
所有验证必须使用**第三方视角**（外部 API 返回、实际日志、真实数据）。

---

## 一、部署前强制验证

### 任何 daemon 代码改动（a.5 相关）

| 验证项 | 方法 | 通过标准 |
|--------|------|---------|
| 语法检查 | `node -e "new Function(fs.readFileSync('daemon_simple.js','utf8'))"` | 无报错 |
| 数学解析器 | `node -e "测试 solveMath() 对 8 种题型"` | 全部返回正确答案 |
| 签到 API | `node -e "调用真实 API，从 checkin 到 verify 全链路"` | checkin 返回 OK |
| 认知挑战 API | `node -e "调用真实 API，问题→解析→回答"` | passed: true |
| 论坛评论 API | `curl POST /api/forum/{id}/comments` | 返回 +3 XP |
| post() 函数 | 传 undefined 参数不掉 | 不报错 |

### 任何 server.js 代码改动

| 验证项 | 方法 | 通过标准 |
|--------|------|---------|
| 语法检查 | `node -e "require('./x402-api/server.js')"` | MODULE_NOT_FOUND 以外无报错 |
| health 端点 | `curl /health` | `{"status":"ok"}` |
| daemon/status 端点 | `curl /daemon/status` | 返回 JSON，新字段存在 |
| heartbeat 端点 | `curl -X POST /daemon/heartbeat -d '{"test":true}'` | 200 OK |

### 任何 dashboard.html 改动

| 验证项 | 方法 | 通过标准 |
|--------|------|---------|
| 数据一致性 | 核对 project_status.md 同字段 | D/T/X 数组一致 |

---

## 二、部署后强制验证（push 后 5 分钟内）

### 必须执行（不可跳过）

```
1. 等待 Render 部署（30-60s）
2. 检查 daemon status: curl /daemon/status
3. 等待 daemon 第一轮周期完成（约 90s）
4. 再次检查 daemon status
5. curl AgentHansa /api/agents/me 检查信誉分
```

### 验证检查清单

| # | 检查项 | 命令/方法 | 通过条件 |
|---|--------|----------|---------|
| 1 | Render 已部署 | `curl /health` 看 version 字段是否更新 | version 匹配 |
| 2 | Daemon 启动 | `curl /daemon/status` 看 uptime | uptime < 120s 说明是新进程 |
| 3 | 签到成功 | 等一轮后看 `lastCheckin` | `true` |
| 4 | 认知通过 | 看 `lastCognitive` | `true` |
| 5 | 论坛评论 | 看 `lastForumComment` | `true` |
| 6 | 有投标 | 看 `submissionsToday` | > 前值 |
| 7 | 信誉分涨了 | curl AgentHansa `/api/agents/me` | reputation > 前值 |
| 8 | 无异常错误 | 看 `errors` 和 `lastErrors` | 新错误数 = 0 |

### 若任一项未通过 → 不继续做其他工作 → 立刻排查

---

## 三、每日巡检（cron 自动化）

```bash
# 每天北京时间 9:00 和 21:00
curl -s https://agenthansa.com/api/agents/me | 提取: reputation, earnings, xp, level
curl -s https://mediacraft-x402-api.onrender.com/daemon/status | 提取: cycles, errors, submissionsToday, earnedToday
```

如果信誉分连续 24 小时不涨 → **红色警报**，daemon 可能又在静默崩溃。

---

## 四、代码审查门禁

以下情况**必须先审查后 push**：

### 需要审查的操作

| 类型 | 审查人 | 审查内容 |
|------|--------|---------|
| daemon_simple.js 任何改动 | 用户确认 | 本地测试结果 |
| 新的 API 调用 | — | 先 curl 确认 API 返回格式 |
| 删除 try-catch | — | 确保上层有错误处理 |
| 修改心跳格式 | — | 两端（daemon+server）同步更新 |

### 禁止的操作

- ✗ 不本地测试就 push daemon 改动
- ✗ 不在 push 后 5 分钟内检查线上状态
- ✗ 同时 push 多个工作线的改动（混在一起无法定位问题）
- ✗ 相信 `errors: 0` 就是没问题

---

## 五、已知需要验证但尚未自动化的

以下项目目前依赖手动验证，应在后续自动化：

- [ ] AgentHansa 信誉分每日变化 → 加到 cron 监控
- [ ] Render 日志实时查询 → 需要 Render API key
- [ ] Daemon 投标成功/失败比例 → 心跳已支持 submissionsToday，需加 winsToday
- [ ] 签到 streak 天数 → 从 AgentHansa API 提取
- [ ] GitHub PR 合并状态 → 可用 GitHub API 查询

---

## 六、事故响应流程

当 `errors > 0` 或 `submissionsToday` 连续 12 小时不增长：

1. **暂停所有其他工作线**
2. 本地复现 daemon 周期
3. curl 所有相关 AgentHansa API，比对返回格式
4. 修复 → 本地验证 → push → 线上验证（5 分钟）
5. 确认恢复后更新 POSTMORTEM.md

---

## 本文件的维护

- 每次事故后更新：添加新的验证项
- 每次 API 对接后更新：记录 API 格式
- 每月回顾：清理过时内容
