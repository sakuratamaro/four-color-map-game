"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

function createStaticServer() {
return http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  fs.stat(target, (statError, stat) => {
    const file = !statError && stat.isDirectory() ? path.join(target, "index.html") : target;
    fs.readFile(file, (error, body) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
        return;
      }
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      });
      response.end(body);
    });
  });
});
}

function startStaticServer(port = 0) {
  return new Promise((resolve, reject) => {
    const server = createStaticServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

if (require.main === module) {
  startStaticServer(Number(process.argv[2] || 4173)).then(({ url }) => process.stdout.write(`STATIC_SERVER ${url}\n`));
}
module.exports = { createStaticServer, startStaticServer };
