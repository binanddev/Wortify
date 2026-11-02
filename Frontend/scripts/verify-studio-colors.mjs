import { build } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
process.chdir(path.resolve(import.meta.dirname, ".."));
const dir = path.resolve(".interface-preview");
await fs.mkdir(dir, { recursive: true });
const entry = path.join(dir, "studio-colors-check.jsx");
await fs.writeFile(
  entry,
  `
import React,{useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';import {HeroUIProvider} from '@heroui/react';
import {Settings} from '../src/features/settings/learning.jsx';import {WindowContext} from '../src/lib/core.js';import {visualDefaults,updateAppearance} from '../src/themes/preferences.js';import {applyAppearance} from '../src/themes/apply.js';import {setLanguage} from '../src/i18n/index.js';import {installAutoContrast} from '../src/features/appearance/auto-contrast.js';
setLanguage('en');window.fetch=async()=>Response.json({});
function App(){const [prefs,save]=useState(()=>JSON.parse(localStorage.getItem('studio-color-check')||'null')||{...visualDefaults,interface:'studio',background:'mist'});
const setPrefs=next=>save(previous=>{const value=updateAppearance(previous,next);localStorage.setItem('studio-color-check',JSON.stringify(value));return value});
useEffect(()=>{applyAppearance(prefs)},[prefs]);useEffect(()=>installAutoContrast(),[]);
window.colorFixture={prefs,setInterface:mode=>setPrefs({...prefs,interface:mode})};
return <HeroUIProvider disableAnimation><WindowContext.Provider value={{route:'/de/settings',navigate:()=>{},active:true,get toolsTarget(){return document.getElementById('workspace-tools')}}}><div className="default-background"/><aside className="nav-face" style={{padding:20,width:260}}><div className="context-panel" id="workspace-tools"/><button className="btn primary" id="nav-primary">Navigation action</button></aside><main style={{padding:20,minWidth:0}}><Settings lang="de" userId={827} staff prefs={prefs} setPrefs={setPrefs} appearance={{data:{}}}/><button className="btn primary" id="color-primary">Primary action</button></main></WindowContext.Provider></HeroUIProvider>}
createRoot(document.getElementById('root')).render(<App/>);
`,
);
await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "StudioColors",
      formats: ["iife"],
      fileName: () => "studio-colors-check.js",
    },
    outDir: dir,
    emptyOutDir: false,
  },
  logLevel: "error",
});
const assets = await fs.readdir("dist/assets");
const css = await fs.readFile(
  path.join(
    "dist/assets",
    assets.find((n) => /^(app|index)-.*\.css$/.test(n)),
  ),
  "utf8",
);
const js = await fs.readFile(path.join(dir, "studio-colors-check.js"), "utf8");
const file = path.join(dir, "studio-colors-check.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="studio"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n#root{display:flex;gap:20px}main{flex:1;margin-left:300px}.nav-face{position:fixed!important;left:16px;top:16px;bottom:16px}@media(max-width:600px){#root{display:block}.nav-face{position:relative!important;left:auto;top:auto;bottom:auto;width:100%!important}main{margin-left:0}}</style><div id="root"></div><script>${js.replaceAll("</script", "<\\/script")}</script></html>`,
);
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const check = (ok, message) => {
  if (!ok) throw Error(message);
};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(pathToFileURL(file).href);
  await page.getByLabel("Default background color", { exact: true }).waitFor();
  for (const nav of ["#142d59", "#ffffff"]) {
    await page.getByLabel("Navigation color", { exact: true }).fill(nav);
    await page.waitForFunction(
      (value) =>
        getComputedStyle(document.querySelector(".nav-face"))
          .backgroundColor === value,
      nav === "#ffffff" ? "rgb(255, 255, 255)" : "rgb(20, 45, 89)",
    );
  }
  await page
    .getByLabel("Default background color", { exact: true })
    .fill("#181c28");
  await page.getByLabel("Accent color", { exact: true }).fill("#ffe400");
  await page.waitForFunction(
    () =>
      getComputedStyle(document.body).backgroundColor === "rgb(24, 28, 40)" &&
      getComputedStyle(document.getElementById("color-primary"))
        .backgroundColor === "rgb(255, 228, 0)",
  );
  await page.reload();
  await page.getByLabel("Navigation color", { exact: true }).waitFor();
  check(
    (await page
      .getByLabel("Navigation color", { exact: true })
      .inputValue()) === "#ffffff",
    "Color lost after reload",
  );
  check(
    (await page
      .getByLabel("Default background color", { exact: true })
      .inputValue()) === "#181c28",
    "Page color lost after reload",
  );
  await page.evaluate(
    () => (document.documentElement.dataset.hasBackground = "true"),
  );
  check(
    (await page
      .locator(".default-background")
      .evaluate((el) => getComputedStyle(el).display)) === "none",
    "Custom color overrides image layer",
  );
  await page.evaluate(
    () => (document.documentElement.dataset.hasBackground = "false"),
  );
  await page.getByLabel("Navigation color", { exact: true }).fill("#142d59");
  await page.getByLabel("Accent color", { exact: true }).fill("#7155bd");
  check(
    await page
      .getByLabel("Navigation color", { exact: true })
      .evaluate((el) => el.getBoundingClientRect().height >= 32),
    "Color swatch too small",
  );
  await page.screenshot({
    path: path.join(dir, "studio-colors-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Reset Studio colors", exact: true })
    .click();
  check(
    (await page
      .getByLabel("Navigation color", { exact: true })
      .inputValue()) === "#294b40",
    "Reset did not restore nav",
  );
  await page.evaluate(() => window.colorFixture.setInterface("glass"));
  await page.waitForFunction(
    () => document.documentElement.dataset.interface === "glass",
  );
  check(
    (await page.locator(".studio-color-settings").count()) === 0,
    "Studio controls leak into Glass",
  );
  check(
    (await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--studio-nav"),
    )) === "",
    "Studio color variables leak",
  );
  await page.evaluate(() => window.colorFixture.setInterface("studio"));
  await page.getByLabel("Navigation color", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(dir, "studio-colors-mobile.png"),
    fullPage: true,
  });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Settings overflow on mobile",
  );
  check(errors.length === 0, errors.join("; "));
  console.log(
    "PASS: actual Studio settings color controls, preview, reload, reset, background image priority, theme isolation and mobile layout",
  );
} finally {
  await browser.close();
}
