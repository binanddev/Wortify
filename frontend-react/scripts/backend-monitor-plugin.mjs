import { monitorFromEnvironment } from "./backend-monitor.mjs";
export function backendMonitorPlugin() {
  const attach = (server) => {
    const monitor = monitorFromEnvironment();
    server.httpServer?.once("listening", () => monitor.start());
    server.httpServer?.once("close", () => monitor.stop());
  };
  return {
    name: "wortify-server-monitor",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
