// Synthetic local fixture only. No database, credentials or external requests.
const http = require("node:http");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const fixture = readFileSync(join(__dirname, "fixture.tsx"), "utf8");
const svg = fixture.match(/const svg='([^']+)'/)[1];
http.createServer((req, res) => {
  req.resume();
  const path = req.url.split("?")[0];
  let status = 200;
  let data = [];
  if (req.method === "OPTIONS") {
    // Allow local Expo web to use the same synthetic endpoint as native.
  } else if (path === "/rest/v1/rpc/get_question_context" ||
             path === "/rest/v1/rpc/get_question_media") {
    data = [];
  } else if (path === "/functions/v1/learning-source") {
    data = { url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg) };
  } else {
    status = 404;
    data = { message: "Isolated notebook QA endpoint only" };
  }
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(JSON.stringify(data));
}).listen(54369, "127.0.0.1");
