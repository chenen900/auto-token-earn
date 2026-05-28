var API = window.location.hostname === "localhost" ? "" : "https://mediacraft-x402-api.onrender.com";
var userEmail = "";

// ========== 导航 ==========
function openTool(t) {
  document.querySelectorAll(".panel").forEach(function (e) { e.classList.add("hidden"); });
  var el = document.getElementById(t);
  if (el) el.classList.remove("hidden");
  window.scrollTo(0, 0);
}
function goHome() {
  document.querySelectorAll(".panel").forEach(function (e) { e.classList.add("hidden"); });
  var el = document.getElementById("home");
  if (el) el.classList.remove("hidden");
}

// ========== 认证 ==========
function showLogin() { document.getElementById("loginModal").style.display = "flex"; }
function hideLogin() { document.getElementById("loginModal").style.display = "none"; }

async function doLogin() {
  var e = document.getElementById("loginEmail").value.trim();
  var p = document.getElementById("loginPassword").value.trim();
  if (!e || !p) return;
  var r = await fetch(API + "/api/v1/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: e, password: p })
  }).then(function (r) { return r.json(); });
  var el = document.getElementById("loginMsg");
  if (r.ok) {
    userEmail = r.user.email;
    el.textContent = "登录成功 — " + r.user.tierName;
    updateUserBar(r.user);
    setTimeout(hideLogin, 1000);
  } else { el.textContent = r.error || "登录失败"; }
}

async function doRegister() {
  var e = document.getElementById("loginEmail").value.trim();
  var p = document.getElementById("loginPassword").value.trim();
  if (!e || !p) return;
  var r = await fetch(API + "/api/v1/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: e, password: p, tier: "free" })
  }).then(function (r) { return r.json(); });
  var el = document.getElementById("loginMsg");
  if (r.ok) {
    userEmail = r.user.email;
    el.textContent = "注册成功 — " + r.user.tierName;
    updateUserBar(r.user);
    setTimeout(hideLogin, 1000);
  } else { el.textContent = r.error || "注册失败"; }
}

function updateUserBar(u) {
  document.getElementById("userStatus").textContent = u.email + " — " + u.tierName;
  document.getElementById("loginBtn").textContent = "账户";
}

// ========== API 辅助 ==========
async function apiPost(path, body) {
  var r = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-email": userEmail },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function apiGet(path) {
  var r = await fetch(API + path);
  return r.json();
}

// ========== 合规检查 ==========
async function checkCompliance() {
  var text = document.getElementById("compText").value.trim();
  if (!text) return alert("请粘贴要检查的文字");
  var el = document.getElementById("compResult");
  el.style.display = "block";
  el.innerHTML = "<div class=loading>检查中...</div>";
  var r = await apiPost("/api/v1/compliance-check", {
    text: text, platform: document.getElementById("compPlatform").value, type: document.getElementById("compType").value
  });
  var sc = r.score >= 90 ? "good" : r.score >= 70 ? "warn" : "bad";
  var items = (r.checks || []).map(function (c) {
    return "<div class='issue " + c.severity + "'><b>[" + c.severity.toUpperCase() + "] " + (c.rule || c.label) + "</b>: " + (c.found || "") + (c.suggestion ? " → " + c.suggestion : "") + "</div>";
  }).join("");
  el.innerHTML = "<h3>审查报告</h3><div class=score " + sc + ">" + r.score + "/100</div><p style=text-align:center;margin-bottom:12px>" + r.verdict + "</p>" + (items || "<div style=text-align:center;color:#34d399;padding:20px>合规检查通过，可以发布</div>");
}

// ========== Listing 生成 ==========
async function generateListing() {
  var name = document.getElementById("genName").value.trim();
  var features = document.getElementById("genFeatures").value.trim();
  var specs = document.getElementById("genSpecs").value.trim();
  var platform = document.getElementById("genPlatform").value;
  if (!name) return alert("请填写产品名称");
  var el = document.getElementById("genResult");
  el.style.display = "block";
  el.innerHTML = "<div class=loading>检查中...</div>";
  var body = name + "\n\n" + features + "\n\n" + specs;
  var seo = await apiPost("/api/v1/seo-optimize", { title: name, description: features, keywords: name.split(""), platform: platform });
  var comp = await apiPost("/api/v1/compliance-check", { text: body, platform: platform, type: "title" });
  var overall = Math.min(seo.score || 70, comp.score || 100);
  var sc = overall >= 90 ? "good" : overall >= 70 ? "warn" : "bad";
  var platNames = { amazon: "Amazon", temu: "Temu", shopify: "Shopify" };
  var issuesHtml = (comp.checks || []).map(function (c) {
    return "<div class='issue " + c.severity + "'><b>[" + c.severity.toUpperCase() + "] " + (c.rule || c.label) + "</b>: " + (c.found || "") + " " + (c.suggestion || "") + "</div>";
  }).join("") || "<div style=color:#34d399;padding:8px>内容合规</div>";
  var tipsHtml = (seo.suggestions || []).slice(0, 3).map(function (s) { return "<div style=color:#94a3b8;font-size:0.85em;margin:4px 0>" + s + "</div>"; }).join("");
  el.innerHTML = "<h3>" + platNames[platform] + " 上架检查报告</h3><div style=display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px><div style=text-align:center><div class=score " + sc + ">" + overall + "</div><div style=color:#94a3b8>综合评分</div></div><div><div style=margin:4px 0>SEO: <b style=color:#60a5fa>" + seo.score + "/100</b></div><div style=margin:4px 0>合规: <b style=color:" + (comp.score > 80 ? "#34d399" : "#fbbf24") + ">" + comp.score + "/100</b></div></div></div>" + issuesHtml + tipsHtml;
}

// ========== 物流估价（选择发货地和目的地时实时更新） ==========
var shippingRatesCache = null;

async function loadShippingRates() {
  if (shippingRatesCache) return shippingRatesCache;
  try { shippingRatesCache = await apiGet("/api/v1/shipping-rates"); } catch (e) { shippingRatesCache = null; }
  return shippingRatesCache;
}

async function updateShippingEstimate() {
  var weight = parseFloat(document.getElementById("prWeight").value) || 0.5;
  var state = document.getElementById("prState").value;
  var origin = document.getElementById("prOrigin").value;
  if (!state || !weight) return;

  var el = document.getElementById("prEstimate");
  try {
    var shipRes = await fetch(API + "/api/v1/shipping-calculate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight: weight, state: state, carrier: "ups", origin: origin })
    });
    var shipData = await shipRes.json();
    if (shipData && !shipData.error) {
      el.style.display = "block";
      el.innerHTML = "<b>" + shipData.origin.name + " → " + shipData.destination.state + "</b> &nbsp;|&nbsp; 预计 " + shipData.destination.deliveryDays + " &nbsp;|&nbsp; 约 <b>$" + shipData.totalUSD + "</b> (¥" + shipData.totalCNY + ") &nbsp;|&nbsp; USPS $" + shipData.allCarriers.usps + " / UPS $" + shipData.allCarriers.ups + " / FedEx $" + shipData.allCarriers.fedex;
    }
  } catch (e) {}
}

async function calcProfit() {
  var cost = parseFloat(document.getElementById("prCost").value) || 0;
  var weight = parseFloat(document.getElementById("prWeight").value) || 0.5;
  var price = parseFloat(document.getElementById("prPrice").value) || 0;
  var state = document.getElementById("prState").value;
  var origin = document.getElementById("prOrigin").value;
  var platform = document.getElementById("prPlatform").value;
  var rate = 7.2;
  var el = document.getElementById("prResult");
  el.style.display = "block";
  el.innerHTML = "<div class=loading>查询 " + state + " 真实费率中...</div>";

  if (!state) { el.innerHTML = "<div style=color:#fbbf24>请先选择目的地州</div>"; return; }

  var shipData = null;
  try {
    var shipRes = await fetch(API + "/api/v1/shipping-calculate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight: weight, state: state, carrier: "ups", origin: origin })
    });
    shipData = await shipRes.json();
  } catch (e) {}

  var shippingUSD = shipData && !shipData.error ? shipData.totalUSD : (weight * 60 / rate);
  var shippingCNY = shipData && !shipData.error ? shipData.totalCNY : (weight * 60);
  var costUSD = cost / rate;
  var platFee = { amazon: 0.15, temu: 0, shopify: 0.03, etsy: 0.065, ebay: 0.13 }[platform] || 0;
  var adBudget = price * 0.2;
  var totalCost = costUSD + shippingUSD + (price * platFee) + adBudget;
  var profit = price - totalCost;
  var margin = price > 0 ? (profit / price * 100) : 0;

  var originName = shipData && shipData.origin ? shipData.origin.name : "义乌";
  var destInfo = shipData && shipData.destination ? shipData.destination.zoneName + " · " + shipData.destination.deliveryDays : state;
  var carrierHtml = "";
  if (shipData && shipData.allCarriers) {
    carrierHtml = "<div style='margin-top:8px;font-size:0.8em;color:#94a3b8;text-align:center'>三大快递: USPS $" + shipData.allCarriers.usps + " | UPS $" + shipData.allCarriers.ups + " | FedEx $" + shipData.allCarriers.fedex + "</div>";
  }
  var breakdownHtml = "";
  if (shipData && shipData.breakdown) {
    breakdownHtml = "<div style='margin-top:8px;font-size:0.75em;color:#64748b;text-align:center'>国际运费 $" + shipData.breakdown.internationalFreight + " + 美国本地 $" + shipData.breakdown.usLastMile + " + 燃油 $" + shipData.breakdown.fuelSurcharge + "</div>";
  }

  el.innerHTML = "<h3>" + originName + " → " + destInfo + "</h3>" +
    "<div style=display:grid;grid-template-columns:1fr 1fr;gap:12px>" +
    "<div class=item><div class=label>进货成本</div><div class=value>¥" + cost.toFixed(0) + " ($" + costUSD.toFixed(2) + ")</div></div>" +
    "<div class=item><div class=label>国际物流 (" + weight + "kg)</div><div class=value>¥" + shippingCNY.toFixed(2) + " ($" + shippingUSD.toFixed(2) + ")</div></div>" +
    "<div class=item><div class=label>平台佣金 (" + (platFee * 100).toFixed(0) + "%)</div><div class=value>$" + (price * platFee).toFixed(2) + "</div></div>" +
    "<div class=item><div class=label>广告预算 (20%)</div><div class=value>$" + adBudget.toFixed(2) + "</div></div>" +
    carrierHtml + breakdownHtml +
    "<div style='margin-top:16px;text-align:center;background:#0f172a;border-radius:8px;padding:16px'>" +
    "<div style=display:grid;grid-template-columns:1fr 1fr;gap:16px>" +
    "<div><div class=label>总成本</div><div style='font-size:1.5em;color:#f87171'>$" + totalCost.toFixed(2) + "</div></div>" +
    "<div><div class=label>利润</div><div style='font-size:2em;font-weight:700;color:" + (profit > 0 ? "#34d399" : "#f87171") + "'>$" + profit.toFixed(2) + " (" + margin.toFixed(1) + "%)</div></div>" +
    "</div></div>";
}

// ========== 批量审查 ==========
async function runBatch() {
  var text = document.getElementById("batchText").value.trim();
  if (!text) return alert("请输入产品列表，每行一个");
  var items = text.split("\n").filter(function (l) { return l.trim(); }).map(function (l) { return { text: l, platform: "amazon", type: "title" }; });
  if (items.length > 100) items = items.slice(0, 100);
  var el = document.getElementById("batchResult");
  el.style.display = "block";
  el.innerHTML = "<div class=loading>批量审查 " + items.length + " 条...</div>";
  var r = await fetch(API + "/api/v1/compliance-batch", {
    method: "POST", headers: { "Content-Type": "application/json", "x-user-email": userEmail },
    body: JSON.stringify({ items: items })
  }).then(function (r) { return r.json(); });
  if (r.error) { el.innerHTML = "<div style=color:#f87171>" + r.error + "</div>"; return; }
  var passCount = r.results.filter(function (x) { return x.passed; }).length;
  var rows = r.results.slice(0, 15).map(function (x, i) {
    return "<div style='margin:4px 0;color:" + (x.passed ? "#34d399" : x.score >= 70 ? "#fbbf24" : "#f87171") + "'>" + (i + 1) + ". " + (x.passed ? "✅ 通过" : "⚠ " + x.score + "分") + "</div>";
  }).join("");
  el.innerHTML = "<h3>批量结果: " + passCount + "/" + r.results.length + " 通过</h3>" + rows;
}

// ========== 市场数据 ==========
async function getMarketData() {
  var kw = document.getElementById("mktKeyword").value.trim();
  if (!kw) return alert("请输入产品关键词");
  var el = document.getElementById("mktResult");
  el.style.display = "block";
  el.innerHTML = "<div class=loading>查询中...</div>";
  var r = await fetch(API + "/api/v1/market-data", {
    method: "POST", headers: { "Content-Type": "application/json", "x-user-email": userEmail },
    body: JSON.stringify({ keyword: kw, platform: "amazon" })
  }).then(function (r) { return r.json(); });
  if (r.error) { el.innerHTML = "<div style=color:#f87171>" + r.error + "</div>"; return; }
  var sellers = r.topSellers.map(function (s) { return "<div style=color:#e2e8f0;font-size:0.85em;margin:2px 0>" + s.title + " — " + s.price + " ★" + s.rating + "</div>"; }).join("");
  el.innerHTML = "<h3>" + kw + " 市场数据</h3>" +
    "<div style=display:grid;grid-template-columns:1fr 1fr;gap:8px>" +
    "<div class=item><div class=label>月销量估算</div><div class=value>" + r.estimatedMonthlySales + "</div></div>" +
    "<div class=item><div class=label>均价</div><div class=value>$" + r.averagePrice + "</div></div>" +
    "<div class=item><div class=label>竞争度</div><div class=value>" + r.competitionLevel + "</div></div>" +
    "<div class=item><div class=label>趋势</div><div class=value>" + r.trend + "</div></div>" +
    "</div><div style=margin-top:12px><div class=label>Top 卖家</div>" + sellers + "</div>" +
    "<div style=color:#64748b;font-size:0.7em;margin-top:8px>" + r.disclaimer + "</div>";
}

// ========== 竞品分析 ==========
async function analyzeCompetitor() {
  var url = document.getElementById("competitorUrl").value.trim();
  if (!url) return alert("请输入竞品链接或 ASIN");
  var el = document.getElementById("compAnalysisResult");
  el.style.display = "block";
  el.innerHTML = "<div class=loading>分析中...</div>";
  var r = await fetch(API + "/api/v1/competitor-analysis", {
    method: "POST", headers: { "Content-Type": "application/json", "x-user-email": userEmail },
    body: JSON.stringify({ url: url })
  }).then(function (r) { return r.json(); });
  if (r.error) { el.innerHTML = "<div style=color:#f87171>" + r.error + "</div>"; return; }
  var strategies = Object.entries(r.suggestedStrategy || {}).map(function (e) { return "<div style='margin:4px 0;font-size:0.85em'><b style=color:#60a5fa>" + e[0] + ":</b> " + e[1] + "</div>"; }).join("");
  el.innerHTML = "<h3>竞品分析</h3>" +
    "<div style=display:grid;grid-template-columns:1fr 1fr;gap:8px>" +
    "<div><div class=label>✅ 优势</div><div>" + (r.strengths || []).map(function (s) { return "<div style=color:#34d399;font-size:0.85em;margin:2px 0>" + s + "</div>"; }).join("") + "</div></div>" +
    "<div><div class=label>⚠ 弱点</div><div>" + (r.weaknesses || []).map(function (s) { return "<div style=color:#f87171;font-size:0.85em;margin:2px 0>" + s + "</div>"; }).join("") + "</div></div>" +
    "</div><div style=margin-top:12px><div class=label>建议策略</div>" + strategies + "</div>";
}

// ========== 反馈 / Bug 提交 ==========
async function submitFeedback() {
  var type = document.getElementById("fbType").value;
  var msg = document.getElementById("fbMessage").value.trim();
  var email = document.getElementById("fbEmail").value.trim() || userEmail;
  if (!msg) return alert("请填写反馈内容");
  var el = document.getElementById("fbResult");
  el.style.display = "block";
  el.innerHTML = "<div class=loading>提交中...</div>";
  try {
    var r = await apiPost("/api/v1/feedback", { type: type, message: msg, email: email, page: window.location.href });
    el.innerHTML = r.ok ? "<div style=color:#34d399;text-align:center;padding:10px>✅ 感谢反馈！我们会尽快处理。</div>"
      : "<div style=color:#f87171>" + (r.error || "提交失败") + "</div>";
    if (r.ok) { document.getElementById("fbMessage").value = ""; }
  } catch (e) {
    el.innerHTML = "<div style=color:#f87171>网络错误，请稍后重试</div>";
  }
}
