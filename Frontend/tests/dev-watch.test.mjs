import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createServer, loadConfigFromFile } from "vite";

test("development watcher skips generated browser profiles and still observes source edits", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "wortify-watch-"));
  let server;
  try {
    const source = join(fixture, "src", "main.js");
    const profile = join(
      fixture,
      ".interface-preview",
      "chrome-qa",
      "Default",
      "Cache",
    );
    await mkdir(join(fixture, "src"), { recursive: true });
    await mkdir(profile, { recursive: true });
    await writeFile(source, "export const value = 1;\n");
    await writeFile(join(profile, "data_0"), "generated browser cache");
    const loaded = await loadConfigFromFile(
      { command: "serve", mode: "development" },
      fileURLToPath(new URL("../vite.config.js", import.meta.url)),
    );
    assert.ok(loaded, "load the real development watch configuration");
    server = await createServer({
      configFile: false,
      root: fixture,
      publicDir: false,
      logLevel: "silent",
      server: { middlewareMode: true, watch: loaded.config.server.watch },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    const watcher = server.watcher;
    const normalizedSourceDir = resolve(fixture, "src").replaceAll("\\", "/");
    const deadline = Date.now() + 5000;
    while (
      !Object.keys(watcher.getWatched()).some(
        (path) => path.replaceAll("\\", "/") === normalizedSourceDir,
      )
    ) {
      assert.ok(Date.now() < deadline, "source directory must become watched");
      await delay(20);
    }
    const changed = new Promise((done, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("source edit was not observed")),
        5000,
      );
      watcher.on("change", (path) => {
        if (resolve(path) !== resolve(source)) return;
        clearTimeout(timeout);
        done(path);
      });
    });
    await writeFile(source, "export const value = 2;\n");
    assert.equal(resolve(await changed), resolve(source));
    const watched = watcher.getWatched();
    assert.equal(
      Object.entries(watched).some(([directory, files]) =>
        [directory, ...files.map((name) => join(directory, name))].some(
          (path) =>
            path
              .replaceAll("\\", "/")
              .split("/")
              .includes(".interface-preview"),
        ),
      ),
      false,
      "browser profile directories and files must not allocate native watchers",
    );
  } finally {
    await server?.close();
    await rm(fixture, { recursive: true, force: true });
  }
});
