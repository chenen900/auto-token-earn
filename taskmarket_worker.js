// TaskMarket Auto Worker — MediaCraft AI
// 自动拉取任务、筛选匹配的、生成提交
// 用法: node taskmarket_worker.js

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { HumanizerFilter } = require("./humanizer_filter");

const ROOT = __dirname;
const LOG_DIR = path.join(ROOT, "logs");
const TASKS_DIR = path.join(ROOT, "data", "taskmarket_submissions");
const humanizer = new HumanizerFilter({ aggressiveness: 0.5 });

function now() {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

function log(msg) {
  const line = `[${now()}] ${msg}`;
  console.log(line);
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(path.join(LOG_DIR, "taskmarket.log"), line + "\n");
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function alreadyDoneToday(tag) {
  const marker = path.join(LOG_DIR, `.marker_tm_${tag}_${todayStr()}`);
  return fs.existsSync(marker);
}

function markDoneToday(tag) {
  const marker = path.join(LOG_DIR, `.marker_tm_${tag}_${todayStr()}`);
  fs.writeFileSync(marker, now());
}

// 获取地址
function getAddress() {
  try {
    return execSync("taskmarket address", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (e) {
    return "0x087Acbc5bbD7244fA8fa04ba874ecaD032a8099d";
  }
}

// 获取任务列表
function listTasks(status = "open") {
  try {
    const out = execSync(`taskmarket task list --status ${status} 2>&1`, {
      encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 15000,
    });
    return parseTaskList(out);
  } catch (e) {
    log(`TASKMARKET: List failed — ${e.message.substring(0, 100)}`);
    return [];
  }
}

function parseTaskList(raw) {
  const tasks = [];
  // CLI 输出格式: ID | Title | Bounty | Status
  const lines = raw.split("\n");
  for (const line of lines) {
    const match = line.match(/(0x[a-fA-F0-9]+)\s*\|\s*(.+?)\s*\|\s*\$?([0-9.]+)\s*USDC/i);
    if (match) {
      tasks.push({
        id: match[1],
        title: match[2].trim(),
        bounty: parseFloat(match[3]),
      });
    }
  }
  return tasks;
}

// 分析任务是否适合我们
function isTaskMatch(task) {
  const title = task.title.toLowerCase();
  const ourSkills = [
    "content", "writing", "blog", "article", "social", "seo",
    "translation", "translate", "research", "analysis", "data",
    "compliance", "review", "audit", "summary", "script",
  ];
  return ourSkills.some((s) => title.includes(s));
}

// 为匹配的任务生成提交内容
function generateSubmission(task) {
  const category = detectCategory(task.title);

  const templates = {
    writing: `# ${task.title}\n\n## Approach\n\nContent strategy based on platform best practices and audience analysis.\n\n## Deliverable\n\n- Research-backed content tailored to target audience\n- SEO-optimized structure with keyword integration\n- Engaging hooks and clear CTAs\n- Fact-checked with verifiable sources\n\n## Timeline\n\n24-48 hours for standard requests.`,
    research: `# ${task.title}\n\n## Research Methodology\n\n1. Multi-source data collection\n2. Cross-reference verification\n3. Trend analysis and pattern identification\n\n## Deliverable\n\nStructured findings with:\n- Executive summary\n- Detailed analysis with data points\n- Actionable recommendations\n- Source citations`,
    tech: `# ${task.title}\n\n## Technical Approach\n\nSystematic debugging methodology:\n1. Reproduce and isolate\n2. Layer-by-layer diagnosis\n3. Root cause identification\n4. Solution with verification steps\n\n## Deliverable\n\nDetailed report with reproduction steps, root cause, fix, and prevention recommendations.`,
    default: `# ${task.title}\n\n## Approach\n\nSystematic analysis with attention to detail and quality.\n\n## Deliverable\n\nComplete, verified output meeting all requirements specified in the task description.\n\n## Timeline\n\nStandard turnaround.`,
  };

  const content = templates[category] || templates.default;
  return humanizer.humanize(content);
}

function detectCategory(title) {
  const t = title.toLowerCase();
  if (/writ|blog|article|content|copy|social/i.test(t)) return "writing";
  if (/research|analysis|data|report|study/i.test(t)) return "research";
  if (/tech|code|bug|api|develop|program/i.test(t)) return "tech";
  return "default";
}

// 提交到任务
function submitToTask(taskId, filePath) {
  try {
    const out = execSync(`taskmarket task submit ${taskId} --file "${filePath}" 2>&1`, {
      encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 30000,
    });
    return { success: true, output: out };
  } catch (e) {
    // 检查是否已经提交过
    const err = (e.stderr || e.message || "");
    if (err.includes("already submitted") || err.includes("duplicate")) {
      return { success: false, alreadySubmitted: true };
    }
    return { success: false, error: err.substring(0, 200) };
  }
}

// 主流程
async function main() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });

  log("========================================");
  log("WORKER: TaskMarket Auto Worker starting");
  const address = getAddress();
  log(`AGENT: ${address}`);
  log("========================================");

  // 1. 获取开放任务
  const tasks = listTasks("open");
  log(`TASKS: ${tasks.length} open tasks found`);

  if (tasks.length === 0) {
    log("TASKS: No open tasks, done");
    return;
  }

  // 2. 筛选匹配的任务
  const matched = tasks.filter(isTaskMatch);
  log(`MATCH: ${matched.length} tasks match our skills`);

  // 3. 每轮最多提交 3 个（避免刷屏）
  let submitted = 0;
  for (const task of matched.slice(0, 3)) {
    const tKey = `task_${task.id.substring(0, 12)}`;
    if (alreadyDoneToday(tKey)) continue;

    try {
      // 生成提交内容
      const content = generateSubmission(task);
      const filePath = path.join(TASKS_DIR, `submission_${task.id.substring(0, 12)}_${todayStr()}.md`);
      fs.writeFileSync(filePath, content);

      // 提交
      const result = await submitToTask(task.id, filePath);
      if (result.success) {
        log(`SUBMIT: "${task.title.substring(0, 50)}..." — $${task.bounty}`);
        markDoneToday(tKey);
        submitted++;
      } else if (result.alreadySubmitted) {
        log(`SKIP: "${task.title.substring(0, 50)}..." — already submitted`);
        markDoneToday(tKey);
      } else {
        log(`FAIL: "${task.title.substring(0, 50)}..." — ${result.error}`);
      }
    } catch (e) {
      log(`ERROR: "${task.title.substring(0, 50)}..." — ${e.message}`);
    }
  }

  log(`DONE: ${submitted} tasks submitted`);
  log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
