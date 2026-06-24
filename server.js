// Local-only server: serves the site and runs save.sh on /api/save.
// Start with: node server.js   (then open http://localhost:5500)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = __dirname;
const PORT = process.env.PORT || 5500;
const ALLOWED_CATEGORIES = ["clients", "insights", "templates", "study", "prompts", "logs"];
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function serveStatic(req, res) {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

function handleSave(req, res) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1_000_000) req.destroy();
  });
  req.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "잘못된 요청 형식입니다." }));
      return;
    }

    const { category, title, content } = payload;
    if (!ALLOWED_CATEGORIES.includes(category) || !title || !content) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "카테고리/제목/내용을 확인해주세요." }));
      return;
    }

    const child = spawn("bash", [path.join(ROOT, "save.sh"), category, title], { cwd: ROOT });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: code === 0, path: stdout.trim(), error: code === 0 ? null : stderr.trim() }));
    });
    child.on("error", (err) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    });

    child.stdin.write(content);
    child.stdin.end();
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/save") return handleSave(req, res);
  if (req.method === "GET") return serveStatic(req, res);
  res.writeHead(405);
  res.end();
});

server.listen(PORT, () => {
  console.log(`Second Brain server running at http://localhost:${PORT}`);
});
