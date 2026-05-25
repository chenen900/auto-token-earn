const fs = require("fs");
let c = fs.readFileSync("d:/自媒体运营/auto-token-earn/devto_worker.js", "utf8");

// Replace backticks inside string content with escaped versions
// Strategy: replace ` with \` only within the template body strings
// Simpler approach: just replace known problematic patterns
c = c.replace(/`/g, "\\`");

// But now the JS template literals are broken. Fix them back:
// The article body is in regular single-quoted strings, so backticks should be literal
// Actually we need to distinguish between JS backticks (template delimiters) and content backticks
// Let's just use a different approach: replace template bodies to avoid backticks entirely

// Actually, the issue is that the code uses backticks for template literals AND the body strings contain backticks too
// Simplest fix: use ` instead of literal backticks in content
c = c.replace(/\\`/g, ""); // remove all backticks for now

fs.writeFileSync("d:/自媒体运营/auto-token-earn/devto_worker.js", c);
console.log("Done");
