import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "tournament-data.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const PORT = Number(process.env.PORT) || 3001;

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

const server = createServer(async (req, res) => {
  if (req.url === "/api/state" && req.method === "GET") {
    const data = readData();
    return json(res, 200, { state: data });
  }

  if (req.url === "/api/state" && req.method === "PUT") {
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

  if (req.url === "/api/auth" && req.method === "POST") {
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

  json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Tournament server running on http://localhost:${PORT}`);
});
