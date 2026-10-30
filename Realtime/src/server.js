import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { TeachingHub, MAX_MESSAGE, originAllowed } from "./protocol.js";
export function createRealtimeServer({
  secret,
  origins,
  maxConnections = 1000,
}) {
  const allowed = new Set(origins),
    hub = new TeachingHub({ secret, maxConnections });
  if (
    !allowed.size ||
    [...allowed].some((origin) => {
      try {
        const u = new URL(origin);
        return !["http:", "https:"].includes(u.protocol) || u.origin !== origin;
      } catch {
        return true;
      }
    })
  )
    throw Error("ALLOWED_ORIGINS must list exact frontend origins");
  const server = createServer((req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          service: "wortify-teaching-realtime",
          protocol: "teaching-v2-public",
            origins: [...allowed],
          key_id: createHash("sha256")
            .update(secret)
            .digest("hex")
            .slice(0, 16),
        }),
      );
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 15000;
  const ws = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE,
    perMessageDeflate: false,
  });
  server.on("upgrade", (req, socket, head) => {
    if (
      req.url !== "/ws" ||
      !originAllowed(req.headers.origin, allowed) ||
      hub.peers.size >= maxConnections
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    ws.handleUpgrade(req, socket, head, (client) =>
      ws.emit("connection", client, req),
    );
  });
  ws.on("connection", (socket) => {
    if (!hub.add(socket)) return;
    socket.alive = true;
    const authTimer = setTimeout(() => {
      if (!hub.peers.get(socket)?.ticket)
        socket.close(1008, "Authentication timeout");
    }, 5000);
    authTimer.unref();
    socket.on("message", (raw, binary) => {
      if (binary) {
        socket.close(1008, "Text messages required");
        return;
      }
      hub.receive(socket, raw);
      if (hub.peers.get(socket)?.ticket) clearTimeout(authTimer);
    });
    socket.on("pong", () => {
      socket.alive = true;
    });
    socket.on("error", () => {});
    socket.on("close", () => {
      clearTimeout(authTimer);
      hub.remove(socket);
    });
  });
  const heartbeat = setInterval(() => {
    hub.sweep();
    for (const socket of ws.clients) {
      if (!socket.alive) {
        socket.terminate();
        continue;
      }
      socket.alive = false;
      socket.ping();
    }
  }, 20000);
  heartbeat.unref();
  function close() {
    clearInterval(heartbeat);
    for (const socket of ws.clients) socket.terminate();
    ws.close();
    server.close();
  }
  return { server, hub, close };
}
