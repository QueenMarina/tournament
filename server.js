import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "tournament-data.json");
const ARCHIVE_FILE = join(__dirname, "tournament-archives.json");
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

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isTournamentState(value) {
  return Boolean(
    isObject(value) &&
      isObject(value.players) &&
      isObject(value.teams) &&
      isObject(value.nodes) &&
      isObject(value.results),
  );
}

function readArchives() {
  if (!existsSync(ARCHIVE_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(ARCHIVE_FILE, "utf-8"));
    const archives = Array.isArray(parsed) ? parsed : parsed.archives;
    if (!Array.isArray(archives)) return [];
    return archives.filter((archive) => isObject(archive) && isTournamentState(archive.state));
  } catch {
    return [];
  }
}

function writeArchives(archives) {
  writeFileSync(ARCHIVE_FILE, JSON.stringify({ archives }, null, 2));
}

function summarizeArchive(archive) {
  return {
    id: archive.id,
    name: archive.name,
    createdAt: archive.createdAt,
    playerCount: Object.keys(archive.state.players ?? {}).length,
    resultCount: Object.keys(archive.state.results ?? {}).length,
  };
}

function archiveSlug(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return slug || "tournament";
}

function createArchiveId(name, archives) {
  const usedIds = new Set(archives.map((archive) => archive.id));
  let id = `${archiveSlug(name)}-${randomUUID().slice(0, 8)}`;

  while (usedIds.has(id)) {
    id = `${archiveSlug(name)}-${randomUUID().slice(0, 8)}`;
  }

  return id;
}

function isAuthorized(req) {
  const auth = req.headers.authorization;
  return Boolean(auth && auth === `Bearer ${ADMIN_PASSWORD}`);
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
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  // --- API routes ---
  if (pathname === "/api/state" && req.method === "GET") {
    const data = readData();
    return json(res, 200, { state: data });
  }

  if (pathname === "/api/state" && req.method === "PUT") {
    if (!isAuthorized(req)) {
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

  if (pathname === "/api/archives" && req.method === "GET") {
    const archives = readArchives().map(summarizeArchive);
    return json(res, 200, { archives });
  }

  if (pathname === "/api/archives" && req.method === "POST") {
    if (!isAuthorized(req)) {
      return json(res, 401, { error: "Unauthorized" });
    }

    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body);
      const name = typeof parsed.name === "string" ? parsed.name.trim().slice(0, 80) : "";

      if (!name) {
        return json(res, 400, { error: "Archive name is required." });
      }

      if (!isTournamentState(parsed.state)) {
        return json(res, 400, { error: "Invalid tournament state." });
      }

      const archives = readArchives();
      const archive = {
        id: createArchiveId(name, archives),
        name,
        createdAt: new Date().toISOString(),
        state: parsed.state,
      };

      archives.unshift(archive);
      writeArchives(archives);
      return json(res, 201, { archive: summarizeArchive(archive) });
    } catch {
      return json(res, 400, { error: "Invalid JSON" });
    }
  }

  if (pathname.startsWith("/api/archives/") && req.method === "GET") {
    const archiveId = decodeURIComponent(pathname.slice("/api/archives/".length));
    const archive = readArchives().find((candidate) => candidate.id === archiveId);

    if (!archive) {
      return json(res, 404, { error: "Archive not found" });
    }

    return json(res, 200, { archive: { ...summarizeArchive(archive), state: archive.state } });
  }

  if (pathname === "/api/auth" && req.method === "POST") {
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

  if (pathname.startsWith("/api/")) {
    return json(res, 404, { error: "API route not found" });
  }

  // --- Static file serving (React frontend) ---
  // If the URL starts with /api, we already handled it above; otherwise treat as static request.
  // Determine the file path
  let filePath = join(DIST_DIR, pathname === "/" ? "index.html" : pathname);

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
