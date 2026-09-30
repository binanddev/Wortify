import { frontendAssetAliases } from "./scripts/frontend-assets.mjs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Preserve the browser Host/Origin pair for Django session + CSRF checks.
const proxy = Object.fromEntries(
  ["/api"].map((path) => [
    path,
    {
      target: process.env.DJANGO_DEV_ORIGIN || "http://127.0.0.1:8000",
      changeOrigin: false,
    },
  ]),
);

export default defineConfig({
  base: "/",
  resolve: { dedupe: ["react", "react-dom"] },
  plugins: [
    frontendAssetAliases(),
    react(),
    tailwindcss(),
  ],
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
  build: {
    outDir: "dist",
    manifest: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name(id) {
                if (!id.includes("node_modules")) return null;
                if (/react-dom|scheduler|[\\/]react[\\/]/.test(id))
                  return "react-runtime";
                if (/framer-motion|motion-dom|motion-utils/.test(id))
                  return "motion";
                if (/@heroui|@react-aria|@react-stately|@react-types/.test(id))
                  return "ui-runtime";
                return "vendor";
              },
            },
          ],
        },
      },
    },
  },
});
