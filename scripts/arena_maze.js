// Arena Maze Runner — Claude 思考驱动版
// 每轮拉取迷宫状态，Claude 分析最优路径，手动提交
const https = require("https");
const fs = require("fs");
const path = require("path");

const daemonSrc = fs.readFileSync(path.join(__dirname, "..", "daemon_simple.js"), "utf-8");
const KEY = (daemonSrc.match(/AGENTHANSA_API_KEY\s*\|\|\s*"([^"]+)"/)||[])[1];

const DATA_DIR = path.join(__dirname, "..", "data", "arena_data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function get(p) {
  return new Promise(r => {
    https.get({hostname:"agenthansa.com",path:p,headers:{Authorization:"Bearer "+KEY},timeout:10000}, res => {
      let d=""; res.on("data",c=>d+=c); res.on("end",()=>{ try { r(JSON.parse(d)); } catch(e) { r(d); } });
    }).on("error",()=>r(null));
  });
}
function post(p,b) {
  return new Promise(r => {
    const d=JSON.stringify(b||{});
    const req=https.request({hostname:"agenthansa.com",path:p,method:"POST",headers:{Authorization:"Bearer "+KEY,"Content-Type":"application/json","Content-Length":Buffer.byteLength(d)},timeout:10000}, res => {
      let o=""; res.on("data",c=>o+=c); res.on("end",()=>{ try { r(JSON.parse(o)); } catch(e) { r(o); } });
    }); req.on("error",()=>r(null)); req.write(d); req.end();
  });
}

// 获取当前 tournament 状态
async function getStatus() {
  const t = await get("/api/arena/tournaments/upcoming");
  if (!t?.id) return null;
  return t;
}

// 获取我的配对/轮次数据
async function getMyPairing(tournamentId) {
  return await get("/api/arena/tournaments/"+tournamentId+"/my-pairing");
}

// 提交回合
async function submitMove(tournamentId, roundNumber, move) {
  return await post("/api/arena/tournaments/"+tournamentId+"/rounds/"+roundNumber+"/submit", { move });
}

// 尝试加入
async function tryJoin(tournamentId) {
  // 尝试多种方法
  const methods = [
    () => post("/api/arena/tournaments/"+tournamentId+"/join", {}),
    () => post("/api/arena/tournaments/"+tournamentId+"/join"),
    () => post("/api/arena/tournaments/join", { tournament_id: tournamentId }),
  ];
  for (const fn of methods) {
    try {
      const r = await fn();
      if (r && !r.detail && !r.error) return r;
    } catch(e) {}
  }
  return null;
}

// ====== CLI ======
if (require.main === module) {
  const cmd = process.argv[2] || "watch";

  (async () => {
    if (cmd === "status") {
      const t = await getStatus();
      if (!t) { console.log("No tournament available"); return; }
      console.log("=== Maze Runner ===");
      console.log("ID:", t.id);
      console.log("Status:", t.status, "/", t.phase);
      console.log("Pot:", t.pot_amount, "| Players:", t.participant_count);
      console.log("Starts:", t.scheduled_at);
      console.log("Round:", t.current_round, "/", t.rounds_per_match);
      if (t.status === "live") {
        const pair = await getMyPairing(t.id);
        console.log("\n=== My Pairing ===");
        console.log(JSON.stringify(pair, null, 2));
      }

    } else if (cmd === "watch") {
      // 监控模式：等 tournament 开始后每轮拉数据
      console.log("Watching for Maze tournament...");
      console.log("(Press Ctrl+C when done)\n");

      let lastRound = -1;
      let joined = false;

      while (true) {
        const t = await getStatus();
        if (!t) { await new Promise(r=>setTimeout(r,15000)); continue; }

        const now = new Date();
        const startTime = new Date(t.scheduled_at);
        const secsToStart = Math.round((startTime - now) / 1000);

        if (t.status === "upcoming") {
          process.stdout.write("\r  Waiting... " + Math.max(0,secsToStart) + "s to start | Players: " + t.participant_count + "   ");
          await new Promise(r=>setTimeout(r, Math.min(30000, Math.max(5000, secsToStart*1000/2))));
          continue;
        }

        if (t.status === "live" && !joined) {
          console.log("\n=== LIVE! ===");
          const jr = await tryJoin(t.id);
          joined = true;
          console.log("Join:", jr ? "OK" : "may already be in");
        }

        if (t.status === "live") {
          const pair = await getMyPairing(t.id);
          if (!pair || !pair.round_number) {
            await new Promise(r=>setTimeout(r, 5000));
            continue;
          }

          if (pair.round_number !== lastRound) {
            lastRound = pair.round_number;
            console.log("\n========================================");
            console.log("ROUND " + pair.round_number + "/" + t.rounds_per_match);
            console.log("========================================");

            // 保存完整数据
            const dataFile = path.join(DATA_DIR, "maze_r" + pair.round_number + "_" + Date.now() + ".json");
            fs.writeFileSync(dataFile, JSON.stringify({ time: new Date().toISOString(), tournament: t, pairing: pair }, null, 2));

            // 展示给 Claude 分析
            console.log("My Score:", pair.my_score, "| Opponent:", pair.opponent_score);
            console.log("\n--- RAW PAIRING DATA ---");
            console.log(JSON.stringify(pair, null, 2));
            console.log("------------------------");

            if (!pair.submitted) {
              console.log("\n>>> CLAUDE: 分析上面的 pairing 数据，决定 move 值");
              console.log(">>> 运行: node scripts/arena_maze.js move <tournament_id> <round> <move_value>");
              console.log(">>> 例如: node scripts/arena_maze.js move " + t.id + " " + pair.round_number + " 3");
            } else {
              console.log("(already submitted)");
            }
          }

          await new Promise(r=>setTimeout(r, 10000));
          continue;
        }

        if (t.status === "settled") {
          console.log("\n=== SETTLED ===");
          console.log("Winner:", t.winner, "| Score:", t.winner_total_score);
          console.log("Pot:", t.pot_amount);
          console.log(JSON.stringify(t.placements, null, 2));
          break;
        }

        await new Promise(r=>setTimeout(r, 15000));
      }

    } else if (cmd === "move") {
      const tid = process.argv[3];
      const round = parseInt(process.argv[4]);
      const move = parseInt(process.argv[5]);
      if (!tid || isNaN(round) || isNaN(move)) {
        console.log("Usage: node scripts/arena_maze.js move <tournament_id> <round> <move>");
        return;
      }
      const r = await submitMove(tid, round, move);
      console.log("Submitted round", round, "move", move);
      console.log(JSON.stringify(r));
    } else {
      console.log("Usage: node scripts/arena_maze.js [status|watch|move]");
    }
  })();
}
