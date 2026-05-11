import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const publicRoot = join(root, "public");
const port = Number(process.env.PORT || 3000);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".sql": "text/plain; charset=utf-8"
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function staticHeaders(filePath) {
  const ext = extname(filePath);
  const cacheControl = [".html", ".js", ".css"].includes(ext)
    ? "no-cache, no-store, must-revalidate"
    : "public, max-age=3600";
  return {
    "content-type": types[ext] || "application/octet-stream",
    "cache-control": cacheControl
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname === "/api/config") {
    send(
      res,
      200,
      JSON.stringify({
        supabaseUrl: process.env.SUPABASE_URL || "",
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
      }),
      { "content-type": "application/json; charset=utf-8", "cache-control": "no-cache, no-store, must-revalidate" }
    );
    return;
  }

  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(publicRoot, requestPath));

  if (!filePath.startsWith(publicRoot)) {
    send(res, 403, "Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    send(res, 200, body, staticHeaders(filePath));
  } catch {
    send(res, 404, "Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Life Planner running at http://localhost:${port}`);
});
