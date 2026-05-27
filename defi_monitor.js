// DeFi Monitor — MediaCraft AI
// 后台追踪 USDC 收益率变化，自动建议迁移
// 纯数据层：不执行交易，只做分析建议
// 用法: node defi_monitor.js

const https = require("https");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "data");
const LOG_FILE = path.join(DATA_DIR, "defi_yields.json");

// ========== 已知协议监控端点 ==========
const PROTOCOLS = [
  { name: "Aave USDC (Base)", url: "https://aave-api-v2.aave.com/data/liquidity/v2?pool=Base" },
  { name: "Morpho Blue", url: "https://blue-api.morpho.org/graphql" },
];

function now() { return new Date().toISOString(); }
function today() { return now().substring(0, 10); }

function log(msg) {
  const line = `[${now().substring(0, 19)}] ${msg}`;
  console.log(line);
}

function loadYields() {
  try {
    if (fs.existsSync(LOG_FILE)) return JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
  } catch (e) {}
  return [];
}

function saveYields(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
}

// ========== 基准收益率（手动更新，参考 DeFiLlama） ==========
const MANUAL_RATES = {
  "Coinbase USDC Rewards": 3.8,
  "Aave V3 USDC (Base)": 5.2,
  "Morpho Blue USDC Gauntlet": 6.8,
  "Beefy USDC Vault (Base)": 7.5,
  "Curve USDC Pool": 4.5,
  "Aerodrome USDC-WETH LP": 11.0,
  "Pendle PT-USDC (Jun 2026)": 13.5,
};

async function fetchCurrentRates() {
  // 当 API 可用时接入实时数据，目前使用手动维护的基准数据
  const rates = { ...MANUAL_RATES, timestamp: now() };
  return rates;
}

async function main() {
  log("DeFi Monitor — Checking yields...");

  const rates = await fetchCurrentRates();
  const history = loadYields();
  const entry = { date: today(), rates };
  history.push(entry);

  // 只保留最近 90 天
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const filtered = history.filter((e) => new Date(e.date) >= cutoff);
  saveYields(filtered);

  // 找最优
  const best = Object.entries(rates)
    .filter(([k]) => k !== "timestamp")
    .sort((a, b) => b[1] - a[1]);

  log(`Best yield: ${best[0][0]} @ ${best[0][1]}%`);
  log(`Worst yield: ${best[best.length - 1][0]} @ ${best[best.length - 1][1]}%`);

  // 如果最优偏离 >2%，建议迁移
  if (history.length >= 2) {
    const prev = history[history.length - 2];
    if (prev && prev.rates) {
      const prevBest = Object.entries(prev.rates)
        .filter(([k]) => k !== "timestamp")
        .sort((a, b) => b[1] - a[1])[0];

      if (prevBest && prevBest[0] !== best[0][0]) {
        log(`ALERT: Best yield moved from ${prevBest[0]} (${prevBest[1]}%) → ${best[0][0]} (${best[0][1]}%)`);
      }
    }
  }

  log("DeFi Monitor — Done");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

module.exports = { MANUAL_RATES, fetchCurrentRates };
