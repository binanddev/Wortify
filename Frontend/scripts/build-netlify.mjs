import "./sync-history.mjs";
import { build, loadEnv } from "vite";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { netlifyRedirects } from "./netlify-routing.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = { ...loadEnv("production", root, ""), ...process.env };
// Validate before building. Only the public upstream origin enters routing output;
// server secrets must never be emitted into the browser bundle or public files.
const redirects = netlifyRedirects(env.BACKEND_ORIGIN);
await build({ root });
await writeFile(new URL("../dist/_redirects", import.meta.url), redirects);
await writeFile(new URL("../dist/404.html", import.meta.url), "Not found\n");
