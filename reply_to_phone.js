// Reply helper — sends properly encoded UTF-8 responses to phone
const https = require("https");
const [cmdId, ...msgParts] = process.argv.slice(2);
const message = msgParts.join(" ");

if (!cmdId || !message) {
  console.log("Usage: node reply_to_phone.js <cmdId> <message>");
  process.exit(1);
}

const data = JSON.stringify({ id: cmdId, response: message, token: "mediacraft-bridge-2026" });
const req = https.request({
  hostname: "mediacraft-x402-api.onrender.com",
  path: "/cmd/respond",
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(data) },
}, (res) => {
  let d = ""; res.on("data", c => d += c);
  res.on("end", () => console.log(d));
});
req.on("error", (e) => console.error(e));
req.write(data);
req.end();
