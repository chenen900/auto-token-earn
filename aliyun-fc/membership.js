// 会员系统 — 免费/会员/专业
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const USERS_FILE = path.join(__dirname, "users.json");
const TIERS = {
  free: { name: "免费版", limit: { batch: 0, export: false, history: false, data: false, competitor: false } },
  premium: { name: "会员", price: "¥9.9/月", limit: { batch: 100, export: true, history: true, data: false, competitor: false } },
  pro: { name: "专业版", price: "¥29.9/月", limit: { batch: 1000, export: true, history: true, data: true, competitor: true } },
};

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")); } catch (e) { return {}; }
}
function saveUsers(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }

function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw + "mediacraft-salt").digest("hex");
}

function register(email, password, tier) {
  var users = loadUsers();
  if (users[email]) return { ok: false, error: "邮箱已注册" };
  users[email] = { email: email, passwordHash: hashPassword(password), tier: tier || "free", createdAt: new Date().toISOString(), checks: [], apiKey: "mc_" + crypto.randomBytes(16).toString("hex") };
  saveUsers(users);
  return { ok: true, user: sanitize(users[email]) };
}

function login(email, password) {
  var users = loadUsers();
  var u = users[email];
  if (!u || u.passwordHash !== hashPassword(password)) return { ok: false, error: "邮箱或密码错误" };
  return { ok: true, user: sanitize(u) };
}

function getUser(email) {
  var u = loadUsers()[email];
  return u ? sanitize(u) : null;
}

function checkAccess(email, feature) {
  var u = loadUsers()[email];
  if (!u) return { ok: false, error: "请先注册" };
  var tier = TIERS[u.tier] || TIERS.free;
  var limit = tier.limit[feature];
  if (limit === undefined) return { ok: false, error: "未知功能" };
  if (limit === 0 || limit === false) return { ok: false, error: "需要升级到 " + TIERS[u.tier === "free" ? "premium" : "pro"].name + " 才能使用此功能" };
  return { ok: true, limit: limit };
}

function saveCheck(email, checkData) {
  var users = loadUsers();
  if (!users[email]) return;
  if (!users[email].checks) users[email].checks = [];
  users[email].checks.unshift({ time: new Date().toISOString(), data: checkData });
  if (users[email].checks.length > 500) users[email].checks.length = 500;
  saveUsers(users);
}

function getHistory(email, limit) {
  var u = loadUsers()[email];
  return u && u.checks ? u.checks.slice(0, limit || 50) : [];
}

function sanitize(u) {
  return { email: u.email, tier: u.tier, tierName: TIERS[u.tier] ? TIERS[u.tier].name : "免费版", createdAt: u.createdAt, apiKey: u.apiKey, checkCount: (u.checks || []).length };
}

function getTiers() { return TIERS; }

module.exports = { register, login, getUser, checkAccess, saveCheck, getHistory, getTiers, TIERS };
