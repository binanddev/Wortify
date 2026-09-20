import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Preserve the browser Host/Origin pair for Django session + CSRF checks.
const proxy = Object.fromEntries(
  ["/api", "/admin", "/static"].map((path) => [
    path,
    {
      target: process.env.DJANGO_DEV_ORIGIN || "http://127.0.0.1:8002",
      changeOrigin: false,
    },
  ]),
);

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/static/react/" : "/",
  resolve: { dedupe: ["react", "react-dom"] },
  plugins: [react(), tailwindcss()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
  build: { outDir: "dist", manifest: true },
}));
