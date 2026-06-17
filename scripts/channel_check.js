// Channel Check — 扫描所有非 AgentHansa 渠道
const https = require("https");

// 简单 HTTP GET
function fetch(url, headers={}) {
  return new Promise(r => {
    const u = new URL(url);
    const opts = {hostname:u.hostname,path:u.pathname+u.search,headers:{...headers,"User-Agent":"MediaCraft-AI"},timeout:10000};
    const mod = u.protocol==="https:"?https:require("http");
    mod.get(opts, res => {
      let d=""; res.on("data",c=>d+=c); res.on("end",()=>{
        try { r({status:res.statusCode, data:JSON.parse(d)}); } catch(e) { r({status:res.statusCode, data:d.substring(0,200)}); }
      });
    }).on("error",e=>r({error:e.message}));
  });
}

(async()=>{
  const results = [];

  // 1. dealwork.ai
  console.log("1/7 dealwork.ai...");
  const dw = await fetch("https://dealwork.ai/api/v1/jobs?status=open", {Authorization:"Bearer ak_d351c9ceecb3d9886a7e19a565bc47cdf482ada8c183500b"});
  results.push({channel:"dealwork.ai", status:dw.status, preview:JSON.stringify(dw.data).substring(0,300)});

  // 2. pinchwork.dev
  console.log("2/7 pinchwork.dev...");
  const pw = await fetch("https://pinchwork.dev/v1/tasks/open");
  results.push({channel:"pinchwork.dev", status:pw.status, preview:JSON.stringify(pw.data).substring(0,300)});

  // 3. clawhunt.sh
  console.log("3/7 clawhunt.sh...");
  const ch = await fetch("https://clawhunt.sh/api/bounties");
  results.push({channel:"clawhunt.sh", status:ch.status, preview:JSON.stringify(ch.data).substring(0,300)});

  // 4. taskmarket
  console.log("4/7 taskmarket...");
  const tm = await fetch("https://api.0xwork.org/tasks?status=open");
  results.push({channel:"taskmarket", status:tm.status, preview:JSON.stringify(tm.data).substring(0,300)});

  // 5. superteam
  console.log("5/7 superteam...");
  const st = await fetch("https://superteam.fun/api/listings");
  results.push({channel:"superteam.fun", status:st.status, preview:JSON.stringify(st.data).substring(0,300)});

  // 6. toku
  console.log("6/7 toku...");
  const tk = await fetch("https://www.toku.agency/api/jobs");
  results.push({channel:"toku.agency", status:tk.status, preview:JSON.stringify(tk.data).substring(0,300)});

  // 7. dev.to
  console.log("7/7 dev.to...");
  const dt = await fetch("https://dev.to/api/articles/me/published", {"api-key":"j6yoCyDvjfHorQnwi2EQH5cn"});
  results.push({channel:"dev.to", status:dt.status, preview:JSON.stringify(dt.data).substring(0,200)});

  console.log("\n=== RESULTS ===");
  for(const r of results){
    const indicator = r.status===200?"✅":r.status===401?"🔐":r.status===404?"❌":"❓";
    console.log(indicator,r.channel,r.status, r.preview);
  }
})();
