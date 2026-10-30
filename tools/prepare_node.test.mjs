import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import {
  auditDependencies,
  dependencyPlan,
  installArguments,
  prepare,
  runInstall,
} from "./prepare_node.mjs";
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wortify-deps-")),
    project = path.join(root, "Realtime");
  fs.mkdirSync(project, { recursive: true });
  const pkg = { name: "test", dependencies: { ws: "1.0.0" } },
    lock = {
      lockfileVersion: 3,
      packages: {
        "": { ...pkg },
        "node_modules/ws": { version: "1.0.0" },
        "node_modules/transitive": { version: "2.0.0" },
        "node_modules/optional-os": { version: "1.0.0", optional: true },
      },
    };
  fs.writeFileSync(path.join(project, "package.json"), JSON.stringify(pkg));
  fs.writeFileSync(
    path.join(project, "package-lock.json"),
    JSON.stringify(lock),
  );
  function install(name, version) {
    const folder = path.join(project, "node_modules", name);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(
      path.join(folder, "package.json"),
      JSON.stringify({ name, version, main: "index.js" }),
    );
    fs.writeFileSync(path.join(folder, "index.js"), "module.exports={};");
  }
  install("ws", "1.0.0");
  install("transitive", "2.0.0");
  return {
    root,
    project,
    pkg,
    lock,
    install,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}
test("complete dependencies are adopted without a stamp or hidden npm lock", async () => {
  const f = fixture();
  try {
    let installs = 0;
    const result = await prepare({
      name: "Realtime",
      root: f.root,
      probe: () => true,
      report() {},
      install: async () => {
        installs++;
      },
    });
    assert.equal(result.action, "reuse");
    assert.equal(installs, 0);
    assert.ok(
      fs.existsSync(path.join(f.root, ".venv/wortify-realtime-npm.txt")),
    );
  } finally {
    f.cleanup();
  }
});
test("an interrupted install is detected even if the direct module entry exists", () => {
  const f = fixture();
  try {
    fs.rmSync(path.join(f.project, "node_modules/transitive/package.json"));
    assert.equal(dependencyPlan(f.project).action, "repair");
    assert.match(auditDependencies(f.project).issues.join(","), /transitive/);
  } finally {
    f.cleanup();
  }
});
test("wrong locked versions are repaired and optional platform packages need not exist", () => {
  const f = fixture();
  try {
    assert.equal(dependencyPlan(f.project).action, "reuse");
    f.install("transitive", "3.0.0");
    assert.match(dependencyPlan(f.project).issues.join(","), /Wrong version/);
    assert.equal(dependencyPlan(f.project, true).action, "clean");
  } finally {
    f.cleanup();
  }
});
test("repair keeps existing modules, reads the warm cache and preserves the lockfile", () => {
  const args = installArguments(false, true);
  assert.equal(args[0], "install");
  assert.ok(args.includes("--offline"));
  assert.ok(args.includes("--no-save"));
  assert.ok(args.includes("--include=dev"));
  assert.equal(args.includes("--cache"), false);
  assert.equal(installArguments(true, false)[0], "ci");
});
test("startup refuses a mismatched package lock instead of changing app versions", async () => {
  const f = fixture();
  try {
    f.pkg.dependencies.ws = "2.0.0";
    fs.writeFileSync(
      path.join(f.project, "package.json"),
      JSON.stringify(f.pkg),
    );
    await assert.rejects(
      prepare({
        name: "Realtime",
        root: f.root,
        probe: () => true,
        report() {},
      }),
      /lockfile/,
    );
  } finally {
    f.cleanup();
  }
});
test("an idle npm is stopped and its failed result never stamps success", async () => {
  const f = fixture();
  try {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.pid = 999;
    child.exitCode = null;
    child.signalCode = null;
    let stopped = 0,
      now = 0;
    const result = await runInstall({
      project: f.project,
      cli: "npm-cli.js",
      args: [],
      logPath: path.join(f.root, "setup.log"),
      heartbeatMs: 5,
      idleMs: 10,
      maxMs: 1000,
      clock: () => (now += 20),
      spawnProcess: () => child,
      progressProbe: () => 0,
      stopProcess: () => {
        stopped++;
        queueMicrotask(() => child.emit("close", 1));
      },
      report() {},
    });
    assert.equal(stopped, 1);
    assert.match(result.reason, /no progress/);
    assert.equal(result.code, 1);
  } finally {
    f.cleanup();
  }
});
test("failed runtime probe cannot be marked ready merely because package metadata exists", async () => {
  const f = fixture();
  try {
    let calls = 0;
    await assert.rejects(
      prepare({
        name: "Realtime",
        root: f.root,
        report() {},
        probe: () => false,
        install: async () => {
          calls++;
          return { code: 1, reason: "test failure" };
        },
      }),
    );
    assert.equal(
      fs.existsSync(path.join(f.root, ".venv/wortify-realtime-npm.txt")),
      false,
    );
  } finally {
    f.cleanup();
  }
});

test("CSS-only packages are validated by their actual assets, not nonexistent JS entries", () => {
  const f = fixture();
  try {
    f.pkg.dependencies["nes.css"] = "2.3.0";
    f.lock.packages[""].dependencies["nes.css"] = "2.3.0";
    f.lock.packages["node_modules/nes.css"] = { version: "2.3.0" };
    fs.writeFileSync(
      path.join(f.project, "package.json"),
      JSON.stringify(f.pkg),
    );
    fs.writeFileSync(
      path.join(f.project, "package-lock.json"),
      JSON.stringify(f.lock),
    );
    f.install("nes.css", "2.3.0");
    fs.rmSync(path.join(f.project, "node_modules/nes.css/index.js"));
    fs.mkdirSync(path.join(f.project, "node_modules/nes.css/css"));
    fs.writeFileSync(
      path.join(f.project, "node_modules/nes.css/css/nes.min.css"),
      "body{}",
    );
    assert.equal(auditDependencies(f.project).issues.length, 0);
  } finally {
    f.cleanup();
  }
});
test("active extraction is not mistaken for an idle npm, but still has an overall deadline", async () => {
  const f = fixture();
  try {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.pid = 999;
    child.exitCode = null;
    child.signalCode = null;
    let now = 0,
      cpu = 0;
    const result = await runInstall({
      project: f.project,
      cli: "npm-cli.js",
      args: [],
      logPath: path.join(f.root, "active.log"),
      heartbeatMs: 5,
      idleMs: 10,
      maxMs: 100,
      clock: () => (now += 20),
      progressProbe: () => ++cpu,
      spawnProcess: () => child,
      stopProcess: () => queueMicrotask(() => child.emit("close", 1)),
      report() {},
    });
    assert.match(result.reason, /exceeded/);
    assert.doesNotMatch(result.reason, /no progress/);
  } finally {
    f.cleanup();
  }
});

test("a package with valid metadata but broken runtime files is quarantined and repaired", async () => {
  const f = fixture();
  try {
    let probes = 0;
    const before = fs.readFileSync(
      path.join(f.project, "package-lock.json"),
      "utf8",
    );
    const result = await prepare({
      name: "Realtime",
      root: f.root,
      probe: () =>
        ++probes === 1
          ? {
              ok: false,
              failed: [{ pkg: "ws", message: "missing internal file" }],
            }
          : { ok: true, failed: [] },
      report() {},
      npmCommand: undefined,
      install: async () => {
        assert.equal(
          fs.existsSync(path.join(f.project, "node_modules/ws")),
          false,
        );
        f.install("ws", "1.0.0");
        return { code: 0, reason: "" };
      },
    });
    assert.equal(result.action, "repair");
    assert.equal(
      fs.readFileSync(path.join(f.project, "package-lock.json"), "utf8"),
      before,
    );
    assert.ok(
      fs.existsSync(
        path.join(f.root, ".development-backups/incomplete-dependencies"),
      ),
    );
  } finally {
    f.cleanup();
  }
});

test("missing PDF worker files trigger a targeted repair even when package metadata is intact", () => {
  const f = fixture();
  try {
    f.pkg.dependencies["pdfjs-dist"] = "4.10.38";
    f.lock.packages[""].dependencies["pdfjs-dist"] = "4.10.38";
    f.lock.packages["node_modules/pdfjs-dist"] = { version: "4.10.38" };
    fs.writeFileSync(
      path.join(f.project, "package.json"),
      JSON.stringify(f.pkg),
    );
    fs.writeFileSync(
      path.join(f.project, "package-lock.json"),
      JSON.stringify(f.lock),
    );
    f.install("pdfjs-dist", "4.10.38");
    const audit = auditDependencies(f.project);
    assert.ok(audit.corrupt.includes("pdfjs-dist"));
    assert.match(audit.issues.join(","), /pdf.worker/);
  } finally {
    f.cleanup();
  }
});

test("a broken transitive UI package is repaired without moving its healthy parent", async () => {
  const f = fixture();
  try {
    let probes = 0;
    await prepare({
      name: "Realtime",
      root: f.root,
      probe: () =>
        ++probes === 1
          ? {
              ok: false,
              failed: [
                {
                  pkg: "ws",
                  relative: "node_modules/transitive",
                  message: "missing ESM file",
                },
              ],
            }
          : { ok: true, failed: [] },
      report() {},
      install: async () => {
        assert.ok(fs.existsSync(path.join(f.project, "node_modules/ws")));
        assert.equal(
          fs.existsSync(path.join(f.project, "node_modules/transitive")),
          false,
        );
        f.install("transitive", "2.0.0");
        return { code: 0, reason: "" };
      },
    });
  } finally {
    f.cleanup();
  }
});

function failingLog() {
  const stream = new PassThrough();
  queueMicrotask(() =>
    stream.destroy(
      Object.assign(new Error("test disk full"), { code: "ENOSPC" }),
    ),
  );
  return stream;
}
function installerChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.pid = 999;
  child.exitCode = null;
  child.signalCode = null;
  return child;
}
test("a log stream error stops the owned installer and returns failure without waiting for a broken end callback", async () => {
  const f = fixture(),
    child = installerChild();
  let stopped = 0;
  try {
    const result = await runInstall({
      project: f.project,
      cli: "npm-cli.js",
      args: [],
      logPath: path.join(f.root, "failed.log"),
      createLog: failingLog,
      spawnProcess: () => child,
      progressProbe: () => 0,
      stopProcess: () => {
        stopped++;
        queueMicrotask(() => child.emit("close", 0));
      },
      report() {},
    });
    assert.equal(stopped, 1);
    assert.equal(result.code, 1);
    assert.match(result.reason, /Cannot write setup log/);
  } finally {
    f.cleanup();
  }
});
test("failed log output has a bounded shutdown even if the installer never emits close", async () => {
  const f = fixture(),
    child = installerChild();
  let stopped = 0;
  child.unref = () => {};
  try {
    const result = await runInstall({
      project: f.project,
      cli: "npm-cli.js",
      args: [],
      logPath: path.join(f.root, "failed.log"),
      createLog: failingLog,
      spawnProcess: () => child,
      progressProbe: () => 0,
      stopProcess: () => stopped++,
      stopGraceMs: 10,
      report() {},
    });
    assert.equal(stopped, 1);
    assert.equal(result.code, 1);
    assert.match(result.reason, /Cannot write setup log/);
  } finally {
    f.cleanup();
  }
});
test("installer is isolated and hidden, while Ctrl+C stops its owned process tree exactly once", async () => {
  const f = fixture(),
    child = installerChild();
  let options,
    stopped = 0;
  const listeners = process.listenerCount("SIGINT");
  try {
    const resultPromise = runInstall({
      project: f.project,
      cli: "npm-cli.js",
      args: [],
      logPath: path.join(f.root, "cancel.log"),
      spawnProcess: (command, args, value) => {
        assert.equal(command, process.execPath);
        assert.equal(args[0], "npm-cli.js");
        options = value;
        return child;
      },
      progressProbe: () => 0,
      stopProcess: () => {
        stopped++;
        queueMicrotask(() => child.emit("close", 1));
      },
      report() {},
    });
    assert.equal(options.detached, true);
    assert.equal(options.windowsHide, true);
    process.emit("SIGINT");
    const result = await resultPromise;
    assert.equal(stopped, 1);
    assert.equal(result.code, 1);
    assert.match(result.reason, /interrupted/);
    assert.equal(process.listenerCount("SIGINT"), listeners);
  } finally {
    f.cleanup();
  }
});
