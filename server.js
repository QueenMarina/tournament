import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "tournament-data.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const PORT = Number(process.env.PORT) || 3001;

// Path to the built React app
const DIST_DIR = join(__dirname, "dist");

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm',
};

function readData() {
  if (!existsSync(DATA_FILE)) return null;
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function writeData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function serveStaticFile(res, filePath, contentType) {
  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(404);
    res.end("File not found");
  }
}

const server = createServer(async (req, res) => {
  const url = req.url;

  // --- API routes ---
  if (url === "/api/state" && req.method === "GET") {
    const data = readData();
    return json(res, 200, { state: data });
  }

  if (url === "/api/state" && req.method === "PUT") {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${ADMIN_PASSWORD}`) {
      return json(res, 401, { error: "Unauthorized" });
    }
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body);
      writeData(parsed);
      return json(res, 200, { ok: true });
    } catch {
      return json(res, 400, { error: "Invalid JSON" });
    }
  }

  if (url === "/api/auth" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const { password } = JSON.parse(body);
      if (password === ADMIN_PASSWORD) {
        return json(res, 200, { ok: true });
      }
      return json(res, 401, { error: "Wrong password" });
    } catch {
      return json(res, 400, { error: "Invalid request" });
    }
  }

  // --- Static file serving (React frontend) ---
  // If the URL starts with /api, we already handled it above – otherwise treat as static request.
  // Determine the file path
  let filePath = join(DIST_DIR, url === "/" ? "index.html" : url);

  // Security: prevent directory traversal attacks
  if (!filePath.startsWith(DIST_DIR)) {
    json(res, 403, { error: "Forbidden" });
    return;
  }

  // Get file extension and MIME type
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  // Check if the file exists
  if (existsSync(filePath)) {
    serveStaticFile(res, filePath, contentType);
  } else {
    // For single-page apps (React Router), fallback to index.html
    const indexPath = join(DIST_DIR, "index.html");
    if (existsSync(indexPath)) {
      serveStaticFile(res, indexPath, "text/html");
    } else {
      json(res, 404, { error: "Not found" });
    }
  }
});

server.listen(PORT, () => {
  console.log(`Tournament server running on http://localhost:${PORT}`);
  console.log(`Serving static files from ${DIST_DIR}`);
});