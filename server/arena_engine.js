// Arena Engine v1 — 答题引擎 + 数据记录
// 明天有数据后改 strategy 函数即可，其余不变
const https = require("https");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data", "arena_data");
const LOG_FILE = path.join(DATA_DIR, "decision_log.jsonl");
const STRATEGY_FILE = path.join(DATA_DIR, "strategy_state.json");

// ====== 数据记录 ======
function logDecision(entry) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const record = { ...entry, time: new Date().toISOString() };
  fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n");
}

function saveRoundData(tournamentId, roundNum, data) {
  const file = path.join(DATA_DIR, `round_${tournamentId}_r${roundNum}.json`);
  fs.writeFileSync(file, JSON.stringify({ saved_at: new Date().toISOString(), ...data }, null, 2));
}

function saveTournamentResult(tournamentId, result) {
  const file = path.join(DATA_DIR, `result_${tournamentId}.json`);
  fs.writeFileSync(file, JSON.stringify({ saved_at: new Date().toISOString(), ...result }, null, 2));
}

// ====== 策略状态（持久化，跨轮次记忆） ======
function loadState() {
  try { return JSON.parse(fs.readFileSync(STRATEGY_FILE, "utf-8")); } catch(e) { return {}; }
}
function saveState(state) {
  try { fs.writeFileSync(STRATEGY_FILE, JSON.stringify(state, null, 2)); } catch(e) {}
}

// ====== 核心策略函数 ======
// ★★★ 明天有数据后改这个函数 ★★★
function computeMove(pairing, tournamentContext) {
  const state = loadState();
  const roundNum = pairing?.round_number || 1;

  // 对手上轮的 move
  const oppLast = pairing?.opponent_last_move;
  // 当前得分
  const myScore = pairing?.my_score || 0;
  const oppScore = pairing?.opponent_score || 0;

  let move = 5; // 默认中位数
  let reasoning = "default_median";

  // === 策略逻辑（当前：基础博弈，明天用数据替换） ===
  if (roundNum === 1) {
    // 第一轮：无历史信息，用中位数加随机
    move = 4 + Math.floor(Math.random() * 4); // 4-7
    reasoning = "round1_midrange";
  } else if (oppLast && oppLast > 0) {
    // 有对手历史：简单追迹策略
    // 假设对手会改变 → 追他上一轮的方向
    if (oppLast >= 7) {
      move = Math.max(1, Math.round(oppLast * 0.5 + Math.random() * 2));
      reasoning = "opp_high_fade";
    } else if (oppLast <= 3) {
      move = Math.min(10, Math.round(oppLast * 1.5 + Math.random() * 3));
      reasoning = "opp_low_chase";
    } else {
      move = Math.max(1, Math.min(10, Math.round(oppLast + (Math.random() - 0.5) * 4)));
      reasoning = "opp_mid_perturb";
    }
  } else if (roundNum >= 4) {
    // 后期：落后就激进，领先就保守
    if (myScore < oppScore - 2) {
      move = 1 + Math.floor(Math.random() * 3); // 1-3 激进
      reasoning = "trailing_aggressive";
    } else if (myScore > oppScore + 2) {
      move = 7 + Math.floor(Math.random() * 3); // 7-9 保守防御
      reasoning = "leading_defensive";
    } else {
      move = 3 + Math.floor(Math.random() * 5); // 3-7 均衡
      reasoning = "balanced";
    }
  }

  // 随机扰动（±1），避免被完美预测
  move = Math.max(1, Math.min(10, move + Math.floor(Math.random() * 3) - 1));

  // === 记录决策日志 ===
  logDecision({
    tournamentId: tournamentContext?.id,
    round: roundNum,
    myScore,
    oppScore,
    oppLastMove: oppLast,
    chosenMove: move,
    reasoning,
    pairingSnapshot: JSON.stringify(pairing).substring(0, 300),
  });

  return { move, reasoning };
}

// ====== 分析函数 ======
function analyzeHistory() {
  const logs = [];
  if (fs.existsSync(LOG_FILE)) {
    const raw = fs.readFileSync(LOG_FILE, "utf-8").trim();
    if (raw) {
      raw.split("\n").forEach(l => { try { logs.push(JSON.parse(l)); } catch(e) {} });
    }
  }

  if (logs.length === 0) return { status: "no_data", message: "还没有数据，等打完几场后再分析" };

  // 按 move 分布统计
  const moveDist = {};
  for (let i = 1; i <= 10; i++) moveDist[i] = 0;
  for (const l of logs) moveDist[l.chosenMove] = (moveDist[l.chosenMove] || 0) + 1;

  // 按 reasoning 统计
  const reasonDist = {};
  for (const l of logs) reasonDist[l.reasoning] = (reasonDist[l.reasoning] || 0) + 1;

  return {
    status: "analyzed",
    totalDecisions: logs.length,
    moveDistribution: moveDist,
    reasonDistribution: reasonDist,
    lastMove: logs[logs.length - 1]?.chosenMove,
    lastMoveTime: logs[logs.length - 1]?.time,
    suggestion: logs.length < 10
      ? "数据不足，至少需要 10 轮决策才能做统计分析"
      : suggestStrategy(logs),
  };
}

function suggestStrategy(logs) {
  // 简单分析：看哪个 move 范围更常见
  const moves = logs.map(l => l.chosenMove);
  const avg = Math.round(moves.reduce((a,b) => a+b, 0) / moves.length);
  const highMoves = moves.filter(m => m >= 7).length;
  const lowMoves = moves.filter(m => m <= 3).length;
  const midMoves = moves.filter(m => m >= 4 && m <= 6).length;

  if (highMoves > lowMoves && highMoves > midMoves) return "对手倾向高数字，考虑用低数字反制";
  if (lowMoves > highMoves && lowMoves > midMoves) return "对手倾向低数字，考虑用高数字反制";
  return "数据分布均匀，维持均衡策略";
}

// ====== CLI ======
if (require.main === module) {
  const cmd = process.argv[2] || "analyze";
  if (cmd === "analyze") {
    console.log(JSON.stringify(analyzeHistory(), null, 2));
  } else if (cmd === "test") {
    // 模拟 6 轮决策
    console.log("=== 模拟 Coin Snipe 6 轮 ===\n");
    const ctx = { id: "sim_test" };
    let myScore = 0, oppScore = 0;
    for (let r = 1; r <= 6; r++) {
      const pairing = {
        round_number: r,
        my_score: myScore,
        opponent_score: oppScore,
        opponent_last_move: r > 1 ? Math.floor(Math.random() * 10) + 1 : null,
      };
      const { move, reasoning } = computeMove(pairing, ctx);
      // 模拟对手出牌（随机）
      const oppMove = Math.floor(Math.random() * 10) + 1;
      const roundResult = move > oppMove ? "win" : move < oppMove ? "loss" : "tie";
      if (roundResult === "win") myScore++;
      else if (roundResult === "loss") oppScore++;
      console.log(`R${r}  我们:${move}  对手:${oppMove}  ${roundResult}  比分:${myScore}-${oppScore}  [${reasoning}]`);
    }
    console.log(`\n最终: ${myScore}-${oppScore} ${myScore >= oppScore ? "✅" : "❌"}`);
    console.log("运行 node server/arena_engine.js analyze 查看数据");
  } else {
    console.log("Usage: node server/arena_engine.js [analyze|test]");
    console.log("  analyze  — 分析已有决策数据");
    console.log("  test     — 模拟 6 轮对抗测试策略");
  }
}

module.exports = { computeMove, saveRoundData, saveTournamentResult, analyzeHistory, logDecision };
