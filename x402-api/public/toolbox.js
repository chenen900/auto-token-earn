var API = "https://mediacraft-api-pucprtuzpc.cn-hangzhou.fcapp.run";
var userEmail = "";

function openTool(t) {
  document.querySelectorAll(".panel").forEach(function (e) { e.classList.add("hidden"); });
  document.getElementById(t).classList.remove("hidden");
  window.scrollTo(0, 0);
}

function goHome() {
  document.querySelectorAll(".panel").forEach(function (e) { e.classList.add("hidden"); });
  document.getElementById("home").classList.remove("hidden");
}

function showLogin() {
  document.getElementById("loginModal").style.display = "flex";
}

function hideLogin() {
  document.getElementById("loginModal").style.display = "none";
}

async function doLogin() {
  var e = document.getElementById("loginEmail").value.trim();
  var p = document.getElementById("loginPassword").value.trim();
  if (!e || !p) return;
  var r = await fetch(API + "/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: e, password: p })
  }).then(function (r) { return r.json(); });
  var el = document.getElementById("loginMsg");
  if (r.ok) {
    userEmail = r.user.email;
    el.textContent = "登录成功 — " + r.user.tierName;
    updateUserBar(r.user);
    setTimeout(function () { document.getElementById("loginModal").style.display = "none"; }, 1000);
  } else {
    el.textContent = r.error || "登录失败";
  }
}

async function doRegister() {
  var e = document.getElementById("loginEmail").value.trim();
  var p = document.getElementById("loginPassword").value.trim();
  if (!e || !p) return;
  var r = await fetch(API + "/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: e, password: p, tier: "free" })
  }).then(function (r) { return r.json(); });
  var el = document.getElementById("loginMsg");
  if (r.ok) {
    userEmail = r.user.email;
    el.textContent = "注册成功 — " + r.user.tierName;
    updateUserBar(r.user);
    setTimeout(function () { document.getElementById("loginModal").style.display = "none"; }, 1000);
  } else {
    el.textContent = r.error || "注册失败";
  }
}

function updateUserBar(u) {
  document.getElementById("userStatus").textContent = u.email + " — " + u.tierName;
  document.getElementById("loginBtn").textContent = "切换";
  try {
    document.getElementById("premiumLocked").style.display = "none";
    document.getElementById("premiumUnlocked").style.display = "block";
  } catch (e) {}
}

async function api(path, body) {
  var r = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function checkCompliance() {
  var text = document.getElementById("compText").value.trim();
  if (!text) return alert("请粘贴要检查的文字");
  var el = document.getElementById("compResult");
  el.style.display = "block";
  el.innerHTML = "<div class=loading>检查中...</div>";
  var r = await api("/api/v1/compliance-check", {
    text: text,
    platform: document.getElementById("compPlatform").value,
    type: document.getElementById("compType").value
  });
  var sc = r.score >= 90 ? "good" : r.score >= 70 ? "warn" : "bad";
  var items = [];
  if (r.checks && r.checks.length > 0) {
    for (var i = 0; i < r.checks.length; i++) {
      var c = r.checks[i];
      items.push("<div class='issue " + c.severity + "'><b>[" + c.severity.toUpperCase() + "] " + (c.rule || c.label) + "</b>: " + (c.found || "") + (c.suggestion ? " " + c.suggestion : "") + "</div>");
    }
  }
  el.innerHTML = "<h3>审查报告</h3><div class=score " + sc + ">" + r.score + "/100</div><p style=text-align:center;margin-bottom:12px>" + r.verdict + "</p>" + (items.length > 0 ? items.join("") : "<div style=text-align:center;color:#34d399;padding:20px>合规检查通过，可以发布</div>");
}

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
  var seo = await api("/api/v1/seo-optimize", { title: name, description: features, keywords: name.split(""), platform: platform });
  var comp = await api("/api/v1/compliance-check", { text: body, platform: platform, type: "title" });
  var overall = Math.min(seo.score || 70, comp.score || 100);
  var sc = overall >= 90 ? "good" : overall >= 70 ? "warn" : "bad";
  var platNames = { amazon: "Amazon", temu: "Temu", shopify: "Shopify" };
  var issuesHtml = "";
  if (comp.checks && comp.checks.length > 0) {
    issuesHtml = comp.checks.map(function (c) {
      return "<div class='issue " + c.severity + "'><b>[" + c.severity.toUpperCase() + "] " + (c.rule || c.label) + "</b>: " + (c.found || "") + " " + (c.suggestion || "") + "</div>";
    }).join("");
  } else {
    issuesHtml = "<div style=color:#34d399;padding:8px>内容合规</div>";
  }
  var tipsHtml = "";
  if (seo.suggestions && seo.suggestions.length > 0) {
    tipsHtml = "<div style=margin-top:12px><div class=label>SEO 优化建议</div>" + seo.suggestions.slice(0, 3).map(function (s) { return "<div style=color:#94a3b8;font-size:0.85em;margin:4px 0>" + s + "</div>"; }).join("") + "</div>";
  }
  el.innerHTML = "<h3>" + platNames[platform] + " 上架检查报告</h3><div style=display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px><div style=text-align:center><div class=score " + sc + ">" + overall + "</div><div style=color:#94a3b8>综合评分</div></div><div><div style=margin:4px 0>SEO: <b style=color:#60a5fa>" + seo.score + "/100</b></div><div style=margin:4px 0>合规: <b style=color:" + (comp.score > 80 ? "#34d399" : "#fbbf24") + ">" + comp.score + "/100</b></div></div></div><div class=item><div class=label>产品标题（请自行翻译后上传）</div><div class=value>" + name + "</div></div><div class=item><div class=label>卖点</div><div class=value>" + (features || "未填写").replace(/\n/g, "<br>") + "</div></div>" + issuesHtml + tipsHtml;
}

function calcProfit() {
  var cost = parseFloat(document.getElementById("prCost").value) || 0;
  var weight = parseFloat(document.getElementById("prWeight").value) || 0.5;
  var platform = document.getElementById("prPlatform").value;
  var price = parseFloat(document.getElementById("prPrice").value) || 0;
  var rate = 7.2;
  var destRates = { US: 60, EU: 55, JP: 40, UK: 55, AU: 65 };
  var destNames = { US: "美国", EU: "欧洲", JP: "日本", UK: "英国", AU: "澳大利亚" };
  var dest = document.getElementById("prDest").value;
  var destName = destNames[dest] || "美国";
  var shippingRate = destRates[dest] || 60;
  var shipping = weight * shippingRate / rate;
  var costUSD = cost / rate;
  var platFee = { amazon: 0.15, temu: 0, shopify: 0.03 }[platform] || 0;
  var adBudget = price * 0.2;
  var totalCost = costUSD + shipping + (price * platFee) + adBudget;
  var profit = price - totalCost;
  var margin = price > 0 ? (profit / price * 100) : 0;
  var el = document.getElementById("prResult");
  el.style.display = "block";
  el.innerHTML = "<h3>利润分析</h3><div style=display:grid;grid-template-columns:1fr 1fr;gap:12px><div class=item><div class=label>进货成本</div><div class=value>" + cost.toFixed(0) + " ($" + costUSD.toFixed(2) + ")</div></div><div class=item><div class=label>物流(" + destName + " ~¥" + shippingRate + "/kg)</div><div class=value>$" + shipping.toFixed(2) + "</div></div><div class=item><div class=label>平台佣金</div><div class=value>$" + (price * platFee).toFixed(2) + "</div></div><div class=item><div class=label>广告预算(20%)</div><div class=value>$" + adBudget.toFixed(2) + "</div></div></div><div style=margin-top:16px;text-align:center><div class=label>总成本</div><div style=font-size:1.5em;color:#f87171>$" + totalCost.toFixed(2) + "</div><div class=label style=margin-top:8px>利润</div><div style='font-size:2em;font-weight:700;color:" + (profit > 0 ? "#34d399" : "#f87171") + "'>$" + profit.toFixed(2) + " (" + margin.toFixed(1) + "%)</div></div>";
}

async function runBatch() {
  var text = document.getElementById("batchText").value.trim();
  if (!text) return alert("请输入产品列表，每行一个");
  var items = text.split("\n").filter(function (l) { return l.trim(); }).map(function (l) { return { text: l, platform: "amazon", type: "title" }; });
  if (items.length > 100) items = items.slice(0, 100);
  var el = document.getElementById("batchResult");
  el.style.display = "block";
  el.innerHTML = "<div class=loading>批量审查 " + items.length + " 条...</div>";
  var r = await fetch(API + "/api/v1/compliance-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-email": userEmail },
    body: JSON.stringify({ items: items })
  }).then(function (r) { return r.json(); });
  if (r.error) { el.innerHTML = "<div style=color:#f87171>" + r.error + "</div>"; return; }
  var passCount = r.results.filter(function (x) { return x.passed; }).length;
  var rows = [];
  for (var i = 0; i < Math.min(r.results.length, 10); i++) {
    var x = r.results[i];
    rows.push("<div style='margin:4px 0;color:" + (x.passed ? "#34d399" : "#f87171") + "'>" + (i + 1) + ". " + (x.passed ? "通过" : x.score + "分") + "</div>");
  }
  el.innerHTML = "<h3>批量结果: " + passCount + "/" + r.results.length + " 通过</h3>" + rows.join("") + (r.results.length > 10 ? "<div style=color:#94a3b8>...还有 " + (r.results.length - 10) + " 条</div>" : "");
}

async function getMarketData() {
  var kw = document.getElementById("mktKeyword").value.trim();
  if (!kw) return alert("请输入产品关键词");
  var el = document.getElementById("mktResult");
  el.style.display = "block";
  el.innerHTML = "<div class=loading>查询中...</div>";
  var r = await fetch(API + "/api/v1/market-data", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-email": userEmail },
    body: JSON.stringify({ keyword: kw, platform: "amazon" })
  }).then(function (r) { return r.json(); });
  if (r.error) { el.innerHTML = "<div style=color:#f87171>" + r.error + "</div>"; return; }
  var sellers = r.topSellers.map(function (s) { return "<div style=color:#e2e8f0;font-size:0.85em>" + s.title + " — " + s.price + " ★" + s.rating + "</div>"; }).join("");
  el.innerHTML = "<h3>" + kw + " 市场数据</h3><div style=display:grid;grid-template-columns:1fr 1fr;gap:8px><div class=item><div class=label>月销量估算</div><div class=value>" + r.estimatedMonthlySales + "</div></div><div class=item><div class=label>均价</div><div class=value>$" + r.averagePrice + "</div></div><div class=item><div class=label>竞争程度</div><div class=value>" + r.competitionLevel + "</div></div><div class=item><div class=label>趋势</div><div class=value>" + r.trend + "</div></div></div><div style=margin-top:12px><div class=label>Top 卖家</div>" + sellers + "</div><div style=color:#64748b;font-size:0.7em;margin-top:8px>" + r.disclaimer + "</div>";
}

async function analyzeCompetitor() {
  var url = document.getElementById("competitorUrl").value.trim();
  if (!url) return alert("请输入竞品链接或 ASIN");
  var el = document.getElementById("compAnalysisResult");
  el.style.display = "block";
  el.innerHTML = "<div class=loading>分析中...</div>";
  var r = await fetch(API + "/api/v1/competitor-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-email": userEmail },
    body: JSON.stringify({ url: url })
  }).then(function (r) { return r.json(); });
  if (r.error) { el.innerHTML = "<div style=color:#f87171>" + r.error + "</div>"; return; }
  var strategies = [];
  var entries = Object.entries(r.suggestedStrategy);
  for (var i = 0; i < entries.length; i++) {
    strategies.push("<div style='margin:4px 0;font-size:0.85em'><b style=color:#60a5fa>" + entries[i][0] + ":</b> " + entries[i][1] + "</div>");
  }
  el.innerHTML = "<h3>竞品分析</h3><div style=display:grid;grid-template-columns:1fr 1fr;gap:8px><div class=item><div class=label>优势</div><div class=value>" + r.strengths.map(function (s) { return " " + s; }).join("<br>") + "</div></div><div class=item><div class=label>弱点</div><div class=value>" + r.weaknesses.map(function (s) { return " " + s; }).join("<br>") + "</div></div></div><div style=margin-top:12px><div class=label>建议策略</div>" + strategies.join("") + "</div><div style=color:#64748b;font-size:0.7em;margin-top:8px>" + r.disclaimer + "</div>";
}
