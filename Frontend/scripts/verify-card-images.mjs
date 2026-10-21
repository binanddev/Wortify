import { build } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
process.chdir(path.resolve(import.meta.dirname, ".."));
const dir = path.resolve(".interface-preview");
const mobile = process.argv.includes("--mobile");
await fs.mkdir(dir, { recursive: true });
const entry = path.join(dir, "card-images-check.jsx");
await fs.writeFile(entry,"import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createRoot} from 'react-dom/client';import CardImage from '../src/features/flashcards/card-image.jsx';import {safeImageLink,imageQuery,commonsResults,searchImages} from '../src/features/flashcards/image-search.js';\nconst assert=(ok,m)=>{if(!ok)throw Error(m)};const wait=()=>new Promise(r=>setTimeout(r,100));\n(async()=>{\nassert(!safeImageLink('data:image/png;base64,abc'),'Data URL accepted');assert(!safeImageLink('https://172.16.0.1/a'),'Private URL accepted');assert(imageQuery('der Bus')==='Bus','Article normalization');\nconst page={title:'File:Bus.jpg',imageinfo:[{mime:'image/jpeg',thumburl:'https://upload.wikimedia.org/test.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Bus.jpg',extmetadata:{Artist:{value:'<b>Author</b>'},LicenseShortName:{value:'CC BY 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by/4.0/'}}}]};\nconst cards=commonsResults({one:page});assert(cards.length===1&&cards[0].image_credit==='Author','Attribution normalization');assert(commonsResults({one:{...page,imageinfo:[{...page.imageinfo[0],extmetadata:{LicenseShortName:{value:'All rights reserved'}}}]}}).length===0,'Nonfree image accepted');\nlet calls=0;window.fetch=async()=>{calls++;return new Response(JSON.stringify({query:{pages:{one:page}}}))};await searchImages('Bus');await searchImages('Bus');assert(calls===2,'Cache failed');\nconst root=createRoot(document.getElementById('root'));root.render(<CardImage card={cards[0]}/>);await wait();assert(renderToStaticMarkup(<CardImage card={cards[0]}/>).includes('<img'),'Image missing');document.querySelector('img')?.dispatchEvent(new Event('error'));await wait();assert(!document.querySelector('img'),'Broken image not hidden');root.render(<CardImage card={{german_text:'Bus'}}/>);await wait();assert(!document.querySelector('figure'),'Empty card changed');\ndocument.getElementById('result').textContent='PASS: safe links, licenses, attribution, search cache, broken-image fallback and unchanged imageless cards';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);\n");
await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "CardImagesCheck",
      formats: ["iife"],
      fileName: () => "card-images-check.js",
    },
    outDir: dir,
    emptyOutDir: false,
  },
});
const assets = await fs.readdir("dist/assets");
let css = await fs.readFile(
  "dist/assets/" + assets.find((x) => /^(app|index)-.*\.css$/.test(x)),
  "utf8",
);
css = css.replaceAll(
  "/assets/",
  pathToFileURL(path.resolve("dist/assets")).href + "/",
);
const js = await fs.readFile(
  path.join(dir, "card-images-check.js"),
  "utf8",
);
const file = path.join(dir, "card-images.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="studio"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><body><div id="root" style="width:${mobile ? 390 : 1440}px;max-width:100%"></div><pre id="result" hidden></pre><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,
);
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    mobile ? "--window-size=390,844" : "--window-size=1440,1000",
    "--user-data-dir=" + path.join(dir, "chrome-card-images-check"),
    "--virtual-time-budget=20000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        mobile ? "card-images-mobile.png" : "card-images.png",
      ),
    pathToFileURL(file).href,
  ],
  {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  },
);
await fs.writeFile(
  path.join(dir, "card-images-dom.html"),
  result.stdout || "",
);
const match = result.stdout?.match(/<pre id="result"[^>]*>([^<]+)<\/pre>/);
if (!match?.[1].startsWith("PASS")) throw Error(match?.[1] || result.stderr);
console.log(match[1]);
