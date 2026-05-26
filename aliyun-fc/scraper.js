// Amazon Listing 爬虫 — 学习真实电商用语
// 爬取 Amazon 搜索结果，提取高频标题词汇，建立"中文→老外实际叫法"词典
const https = require("https");
const fs = require("fs");
const path = require("path");

const CATEGORIES = [
  { keyword: "bluetooth speaker portable waterproof", cn: "蓝牙音箱" },
  { keyword: "facial toner moisturizing", cn: "爽肤水" },
  { keyword: "power bank fast charging", cn: "充电宝" },
  { keyword: "usb c cable fast charging", cn: "数据线" },
  { keyword: "yoga mat non slip", cn: "瑜伽垫" },
  { keyword: "phone case shockproof", cn: "手机壳" },
  { keyword: "led desk lamp", cn: "台灯" },
  { keyword: "backpack large capacity", cn: "背包" },
  { keyword: "wireless earbuds bluetooth", cn: "蓝牙耳机" },
  { keyword: "face mask skincare", cn: "面膜" },
];

function fetchAmazon(keyword, page) {
  return new Promise((resolve, reject) => {
    var url = "https://www.amazon.com/s?k=" + encodeURIComponent(keyword) + (page > 1 ? "&page=" + page : "");
    var opts = {
      hostname: "www.amazon.com",
      path: "/s?k=" + encodeURIComponent(keyword) + (page > 1 ? "&page=" + page : ""),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
    };
    https.get(opts, (res) => {
      var html = "";
      res.on("data", (c) => html += c);
      res.on("end", () => {
        // 提取标题（简化版——生产环境用 cheerio）
        var titles = [];
        var re = /<span class="a-size-medium a-color-base a-text-normal"[^>]*>([^<]+)<\/span>/g;
        var m;
        while ((m = re.exec(html)) !== null) titles.push(m[1].trim());
        var re2 = /<h2[^>]*><span[^>]*>([^<]+)<\/span><\/h2>/g;
        while ((m2 = re2.exec(html)) !== null) titles.push(m2[1].trim());
        resolve(titles);
      });
    }).on("error", reject);
  });
}

function extractTerms(titles) {
  // 提取高频词
  var words = {};
  var stopWords = new Set(["the","a","an","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","shall","should","may","might","must","can","could","of","in","on","at","to","for","with","by","from","up","about","into","through","during","and","but","or","nor","not","so","if","then","than","too","very","just","that","this","it","its","as","no"]);
  titles.forEach((t) => {
    t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/).forEach((w) => {
      if (w.length < 2 || stopWords.has(w)) return;
      words[w] = (words[w] || 0) + 1;
    });
  });
  return Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 30);
}

async function main() {
  console.log("=== Amazon 电商术语爬取 ===\n");
  var results = {};
  for (var i = 0; i < CATEGORIES.length; i++) {
    var cat = CATEGORIES[i];
    console.log("Fetching:", cat.keyword, "(→", cat.cn, ")");
    try {
      var titles = await fetchAmazon(cat.keyword, 1);
      if (titles.length === 0) { console.log("  No results (may be blocked)"); continue; }
      var terms = extractTerms(titles);
      results[cat.cn] = { titles: titles.slice(0, 5), topTerms: terms };
      console.log("  Found", titles.length, "products");
      console.log("  Top terms:", terms.slice(0, 8).map((t) => t[0]).join(", "));
      // 延迟防止被限流
      await new Promise((r) => setTimeout(r, 3000));
    } catch (e) { console.log("  Error:", e.message); }
  }

  fs.writeFileSync(path.join(__dirname, "amazon_terms.json"), JSON.stringify(results, null, 2));
  console.log("\nSaved to amazon_terms.json");
}

main();
