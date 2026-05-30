# Daemon 排障日志 — 2026-05-30

> 问题：daemon 运行 5 天，submissions/wins/earned 始终为 0，从未产出收益。
> 根因：4 个 bug，其中 1 个致命（每次投标静默崩溃）。

---

## 发现的 Bug

### Bug 1（致命）：`response` 变量未声明 + `isPersonalTask` 丢失

**位置**：`daemon_simple.js` 第 229 行

```javascript
// 修复前 — 每次投标都抛 TypeError
try {
  undefined                          // ← 应该是 isPersonalTask
  ? (复杂的 personal task 模板逻辑)
  : genResponse(cat);               // ← 结果没赋值给任何变量！

  response = humanize(response);    // ← response 未定义 → humanize(undefined) → Crash
} catch(e) { log("BID ERR: " + e.message); }
```

修复：
```javascript
let response = isPersonalTask       // ← 声明变量 + 正确条件
  ? (personal task 模板) : genResponse(cat);
response = humanize(response);
```

**教训**：try-catch + log 不等于"处理了错误"。关键路径上的每一个 catch 都应该打印完整堆栈（`e.stack`），不只是 `e.message`。

### Bug 2：`humanize()` 无空值保护

**位置**：`daemon_simple.js` 第 22 行

```javascript
// 修复前 — 传入 undefined 直接崩溃
function humanize(text) { let r = text; ... r.split(...) ... }

// 修复后
function humanize(text) { if (!text) return ""; ... }
```

**教训**：所有工具函数必须防御 null/undefined 输入，尤其是在 try-catch 内调用的。

### Bug 3：`genResponse()` 调用 `getRelevantAtoms` 无保护

**位置**：`daemon_simple.js` 第 76 行

知识库模块加载失败或返回异常时，整个 genResponse 会抛异常，进而导致投标循环中断。

```javascript
// 修复：加 try-catch 包裹
function genResponse(cat) {
  let tips = [];
  try { tips = getRelevantAtoms("A", cat, 3) || []; } catch(e) {}
  ...
}
```

### Bug 4：两处残留的裸 `undefined`

**位置**：`daemon_simple.js` 第 96 行、第 310 行

低危但混乱——`undefined` 作为独立语句，可能是已删除变量的残留。

---

## 为什么 5 天才发现

| 问题 | 后果 |
|------|------|
| try-catch 吞掉所有异常 | `errors: 0` 给人假安全感 |
| status 端点只看进程存活 | `submissionsToday` 字段存在但从 stdout 无法解析 |
| 每次 push 杀 daemon | 从没完整跑过一天，每次重启后第一轮就崩 |
| 从未本地跑一轮看日志 | 没发现 BID ERR 刷屏 |

---

## 本地测试方法

部署前本地跑一轮验证：

```bash
cd auto-token-earn
# 快速测试投标逻辑（不调 AgentHansa API）
node -e "
const { getRelevantAtoms } = require('./knowledge_base.js');
// ... 模拟 4 个 quest，检查 humanize + genResponse 不报错
"
```

更完整的测试（需要 AgentHansa API key）：
```bash
# 修改 daemon_simple.js 的 main() 初始延迟从 60s 改成 2s，跑一轮观察
AGENTHANSA_API_KEY=tabb_xxx node daemon_simple.js
```

---

## 搬家清单

换电脑/换服务器时这些需要一并迁移：

- [ ] `auto-token-earn/data/` 目录（memory_v3.json、compliance_audit.json 等持久数据）
- [ ] `auto-token-earn/logs/` 目录（历史日志）
- [ ] `auto-token-earn/knowledge_base.js` + 知识库数据
- [ ] 环境变量：`AGENTHANSA_API_KEY`
- [ ] Render deploy 配置（`render.yaml`）
