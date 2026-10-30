import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = new Set(["Frontend", "Realtime"]);
export function dependencyInputs(project) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(project, "package.json"), "utf8"),
  );
  const lock = JSON.parse(
    fs.readFileSync(path.join(project, "package-lock.json"), "utf8"),
  );
  return {
    pkg,
    lock,
    hash: crypto
      .createHash("sha256")
      .update(JSON.stringify([pkg, lock]))
      .digest("hex"),
  };
}
export function auditDependencies(project) {
  const { pkg, lock, hash } = dependencyInputs(project),
    issues = [],
    corrupt = new Set();
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };
  const locked = {
    ...lock.packages?.[""]?.dependencies,
    ...lock.packages?.[""]?.devDependencies,
  };
  for (const [name, range] of Object.entries(declared))
    if (locked[name] !== range) issues.push(`Lockfile differs: ${name}`);
  for (const [relative, entry] of Object.entries(lock.packages || {})) {
    if (!relative.startsWith("node_modules/") || entry.optional || entry.link)
      continue;
    let installed;
    try {
      installed = JSON.parse(
        fs.readFileSync(path.join(project, relative, "package.json"), "utf8"),
      );
    } catch {
      issues.push(`Missing package: ${relative}`);
      continue;
    }
    if (entry.version && installed.version !== entry.version)
      issues.push(`Wrong version: ${relative}`);
  }
  const require = createRequire(path.join(project, "package.json"));
  const assetEntries = {
    "nes.css": ["css/nes.min.css"],
    "pdfjs-dist": [
      "build/pdf.mjs",
      "build/pdf.worker.min.mjs",
      "legacy/build/pdf.mjs",
      "legacy/build/pdf.worker.mjs",
    ],
    rpgui: ["rpgui.min.css", "img/background-image.png"],
  };
  for (const name of Object.keys(declared)) {
    if (assetEntries[name]) {
      for (const asset of assetEntries[name])
        if (!fs.existsSync(path.join(project, "node_modules", name, asset))) {
          issues.push(`Missing asset: ${name}/${asset}`);
          corrupt.add(name);
        }
      continue;
    }
    try {
      const file = require.resolve(name);
      if (!fs.statSync(file).isFile()) {
        issues.push(`Missing entry: ${name}`);
        corrupt.add(name);
      }
    } catch {
      {
        issues.push(`Missing entry: ${name}`);
        corrupt.add(name);
      }
    }
  }
  if (
    pkg.dependencies?.["pdfjs-dist"] &&
    !fs.existsSync(
      path.join(project, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),
    )
  )
    issues.push("Missing PDF worker");
  return { hash, issues: [...new Set(issues)], corrupt: [...corrupt] };
}
export function dependencyPlan(project, clean = false) {
  const audit = auditDependencies(project);
  return {
    ...audit,
    action: clean ? "clean" : audit.issues.length ? "repair" : "reuse",
  };
}
export function npmCli(npmCommand) {
  const candidates = [
    process.env.npm_execpath,
    npmCommand &&
      path.join(path.dirname(npmCommand), "node_modules/npm/bin/npm-cli.js"),
    path.join(
      path.dirname(process.execPath),
      "node_modules/npm/bin/npm-cli.js",
    ),
  ];
  const result = candidates.find(
    (candidate) =>
      candidate &&
      path.basename(candidate) === "npm-cli.js" &&
      fs.existsSync(candidate),
  );
  if (!result)
    throw Error(
      "Cannot locate npm-cli.js. Reinstall Node.js or pass --npm with the installed npm.cmd path.",
    );
  return result;
}
export function installArguments(clean = false, offline = false) {
  return [
    clean ? "ci" : "install",
    "--no-save",
    "--include=dev",
    "--include=optional",
    offline ? "--offline" : "--prefer-offline",
    "--no-audit",
    "--no-fund",
    "--progress=false",
    "--loglevel=http",
    "--fetch-retries=1",
    "--fetch-timeout=60000",
    "--update-notifier=false",
  ];
}
export function stopOwnedProcess(child, platform = process.platform) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  // No cmd/batch wrapper: Ctrl+C cannot leave an npm batch job behind.
  if (platform === "win32")
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
      timeout: 5000,
    });
  else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}
export function installerCpu(pid) {
  if (process.platform !== "win32") {
    try {
      const stat = fs
        .readFileSync(`/proc/${pid}/stat`, "utf8")
        .slice(
          fs.readFileSync(`/proc/${pid}/stat`, "utf8").lastIndexOf(")") + 2,
        )
        .split(" ");
      return Number(stat[11]) + Number(stat[12]);
    } catch {
      return null;
    }
  }
  const powershell = path.join(
    process.env.SystemRoot || "C:/Windows",
    "System32/WindowsPowerShell/v1.0/powershell.exe",
  );
  const result = spawnSync(
    powershell,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `(Get-Process -Id ${Number(pid)} -ErrorAction Stop).TotalProcessorTime.TotalMilliseconds.ToString([System.Globalization.CultureInfo]::InvariantCulture)`,
    ],
    { encoding: "utf8", windowsHide: true, timeout: 3000 },
  );
  const value = Number(result.stdout?.trim());
  return result.status === 0 && Number.isFinite(value) ? value : null;
}
export async function runInstall({
  project,
  cli,
  args,
  logPath,
  maxMs = 600000,
  idleMs = 90000,
  heartbeatMs = 10000,
  stopGraceMs = 5000,
  spawnProcess = spawn,
  stopProcess = stopOwnedProcess,
  report = console.log,
  clock = Date.now,
  progressProbe = installerCpu,
  createLog = fs.createWriteStream,
}) {
  const output = createLog(logPath, { flags: "a" }),
    started = clock();
  let lastActivity = started,
    lastLine = "",
    reason = "",
    done = false,
    grace,
    complete,
    logFailure = "",
    settleResult;
  const child = spawnProcess(process.execPath, [cli, ...args], {
    cwd: project,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    // Give Windows installers a hidden, separate console/process group. The
    // helper alone receives Ctrl+C and can stop the owned npm lifecycle tree.
    detached: true,
  });
  let previousCpu = progressProbe(child.pid);
  const collect = (data) => {
    if (done) return;
    if (!logFailure && !output.destroyed) output.write(data);
    lastActivity = clock();
    const lines = data.toString().trim().split(/\r?\n/);
    lastLine = lines.at(-1) || lastLine;
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  function stop(message) {
    if (done || reason) return;
    reason = message;
    try {
      stopProcess(child);
    } catch (error) {
      reason += ` Could not stop installer PID ${child.pid}: ${error.message}`;
    }
    grace = setTimeout(() => {
      child.stdout?.destroy?.();
      child.stderr?.destroy?.();
      child.unref?.();
      complete?.(1);
    }, stopGraceMs);
  }
  output.on("error", (error) => {
    logFailure = `Cannot write setup log ${logPath}: ${error.message}`;
    if (done) settleResult?.();
    else stop(logFailure);
  });
  const interrupted = () =>
    stop(
      "Installation interrupted. Dependencies will be repaired incrementally on the next run.",
    );
  process.on("SIGINT", interrupted);
  process.on("SIGTERM", interrupted);
  const timer = setInterval(() => {
    const cpu = progressProbe(child.pid),
      heartbeatNow = clock();
    if (cpu !== null && previousCpu !== null && cpu > previousCpu)
      lastActivity = heartbeatNow;
    previousCpu = cpu;
    const elapsed = heartbeatNow - started;
    if (elapsed >= maxMs)
      stop(
        `Dependency preparation exceeded ${Math.round(maxMs / 60000)} minutes. See the setup log; the launcher will not wait indefinitely.`,
      );
    else if (heartbeatNow - lastActivity >= idleMs)
      stop(
        "npm produced no progress for 90 seconds. See the setup log for network or file-lock details.",
      );
    else
      report(
        `  Dang chuan bi thu vien: ${Math.round(elapsed / 1000)} giay. ${/cache (hit|revalidated)/.test(lastLine) ? "Dang giai nen tu cache." : /http fetch/.test(lastLine) ? "Dang tai goi con thieu." : "Dang giai nen/kiem tra tep."}`,
      );
  }, heartbeatMs);
  return await new Promise((resolve) => {
    const finish = (code, error) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      clearTimeout(grace);
      process.removeListener("SIGINT", interrupted);
      process.removeListener("SIGTERM", interrupted);
      settleResult = () =>
        resolve({
          code: reason || logFailure || error ? 1 : (code ?? 1),
          reason: reason || logFailure || error?.message || "",
          lastLine,
          logPath,
        });
      // An errored/destroyed WriteStream is not guaranteed to invoke an end
      // callback. Resolve directly after stopping the owned installer instead.
      if (logFailure || output.destroyed) settleResult();
      else output.end(settleResult);
    };
    complete = finish;
    child.once("error", (error) => finish(1, error));
    child.once("close", (code) => finish(code));
  });
}
function runtimeProbe(project, name) {
  const packages =
    name === "Frontend"
      ? [
          "vite",
          "@tailwindcss/vite",
          "react",
          "react-dom",
          "framer-motion",
          "@heroui/react",
          "motion-dom",
          "motion-utils",
          "react-aria",
          "react-aria-components",
          "react-stately",
          "pdf-lib",
        ]
      : ["ws"];
  const code = `const failed=[];for(const pkg of ${JSON.stringify(packages)}){try{await import(pkg);}catch(error){failed.push({pkg,message:error.message,file:error.url||error.requireStack?.[0]||error.cause?.url||error.cause?.requireStack?.[0]});}}console.log(JSON.stringify(failed));process.exitCode=failed.length?1:0;`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    { cwd: project, encoding: "utf8", timeout: 20000, windowsHide: true },
  );
  let failed = [];
  try {
    failed = JSON.parse(result.stdout.trim().split("\n").at(-1));
  } catch {}
  const entries = Object.keys(dependencyInputs(project).lock.packages || {})
    .filter((value) => value.startsWith("node_modules/"))
    .sort((a, b) => b.length - a.length);
  for (const failure of failed) {
    if (!failure.file) continue;
    let file;
    try {
      file = failure.file.startsWith("file:")
        ? fileURLToPath(failure.file)
        : failure.file;
    } catch {
      continue;
    }
    failure.relative = entries.find((relative) =>
      path.resolve(file).startsWith(path.resolve(project, relative) + path.sep),
    );
  }
  return { ok: result.status === 0, failed };
}
function probeResult(result) {
  return typeof result === "boolean" ? { ok: result, failed: [] } : result;
}
function quarantineIncompletePackages(root, project, failed) {
  const modules = path.resolve(project, "node_modules"),
    declared = dependencyInputs(project).pkg;
  const allowed = { ...declared.dependencies, ...declared.devDependencies };
  for (const { pkg, relative } of failed) {
    if (!relative && !Object.hasOwn(allowed, pkg)) continue;
    if (relative && !dependencyInputs(project).lock.packages[relative])
      throw Error("Unrecognized locked dependency repair target.");
    const target = relative
      ? path.resolve(project, relative)
      : path.resolve(modules, pkg);
    if (!target.startsWith(modules + path.sep))
      throw Error("Invalid dependency repair target.");
    if (!fs.existsSync(target)) continue;
    const backup = path.join(
      root,
      ".development-backups",
      "incomplete-dependencies",
      String(Date.now()),
      relative || pkg,
    );
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.renameSync(target, backup);
  }
}

export async function prepare({
  name,
  root = ROOT,
  npmCommand,
  clean = false,
  report = console.log,
  install = runInstall,
  probe = runtimeProbe,
}) {
  if (!PROJECTS.has(name))
    throw Error(
      "Only Frontend and Realtime dependency preparation is supported.",
    );
  const project = path.join(root, name),
    stamp = path.join(root, ".venv", `wortify-${name.toLowerCase()}-npm.txt`);
  report(`[${name}] Kiem tra thu vien hien co...`);
  let plan = dependencyPlan(project, clean);
  if (plan.issues.some((issue) => issue.startsWith("Lockfile differs:")))
    throw Error(
      "package.json and package-lock.json differ. Update the lockfile before starting; startup never changes dependency versions.",
    );
  const runtime = probeResult(probe(project, name));
  if (!runtime.ok)
    plan = {
      ...plan,
      action: "repair",
      issues: [
        ...plan.issues,
        ...(runtime.failed.length
          ? runtime.failed.map((item) => `Incomplete files: ${item.pkg}`)
          : ["Runtime/native dependency is incomplete"]),
      ],
    };
  if (plan.action === "reuse") {
    fs.mkdirSync(path.dirname(stamp), { recursive: true });
    fs.writeFileSync(stamp, plan.hash);
    report(`[${name}] Thu vien day du, bo qua cai dat.`);
    return { action: "reuse" };
  }
  report(
    `[${name}] ${clean ? "Cai sach theo yeu cau -Install." : `Bo sung/sua ${plan.issues.length} muc thieu, giu lai thu vien dang co.`}`,
  );
  quarantineIncompletePackages(root, project, [
    ...runtime.failed,
    ...(plan.corrupt || []).map((pkg) => ({ pkg })),
  ]);
  const logs = path.join(root, ".development-backups/setup");
  fs.mkdirSync(logs, { recursive: true });
  const logPath = path.join(logs, `${name.toLowerCase()}-${Date.now()}.log`),
    cli = npmCli(npmCommand);
  report(`  Chi tiet cai dat: ${logPath}`);
  // Prefer the user's already-warm default npm cache, not a new repo-local cache.
  let result = await install({
    project,
    cli,
    args: installArguments(clean, true),
    logPath,
    report,
  });
  if (
    result.code !== 0 &&
    !result.reason &&
    /ENOTCACHED|cache mode is 'only-if-cached'/.test(
      fs.readFileSync(logPath, "utf8"),
    )
  ) {
    report(
      "  Cache chua du. Chi tai cac goi con thieu; moi request gioi han 60 giay.",
    );
    result = await install({
      project,
      cli,
      args: installArguments(clean, false),
      logPath,
      report,
    });
  }
  if (result.code !== 0 || result.reason)
    throw Error(
      `${result.reason || "npm could not finish dependency preparation."} Log: ${logPath}`,
    );
  const after = auditDependencies(project);
  const verified = probeResult(probe(project, name));
  if (after.issues.length || !verified.ok) {
    const detail = [
      ...after.issues,
      ...verified.failed.map(({ pkg, message }) => `${pkg}: ${message}`),
    ]
      .slice(0, 5)
      .join("; ");
    throw Error(
      `Dependency validation failed after installation. ${detail} Log: ${logPath}`,
    );
  }
  fs.mkdirSync(path.dirname(stamp), { recursive: true });
  fs.writeFileSync(stamp, after.hash);
  report(`[${name}] Thu vien san sang.`);
  return { action: plan.action, logPath };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2),
    name = args[args.indexOf("--project") + 1],
    npmCommand = args.includes("--npm")
      ? args[args.indexOf("--npm") + 1]
      : undefined;
  prepare({ name, npmCommand, clean: args.includes("--clean") }).catch(
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
