import { createRealtimeServer } from "./server.js";
const port = Number(process.env.PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("Invalid PORT");
const service = createRealtimeServer({
  secret: process.env.TEACHING_REALTIME_SECRET,
  origins: (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
  maxConnections: Number(process.env.MAX_CONNECTIONS || 1000),
});
service.server.listen(port, "0.0.0.0", () =>
  console.log(`Wortify realtime listening on port ${port}`),
);
process.on("SIGTERM", () => service.close());
process.on("SIGINT", () => service.close());
