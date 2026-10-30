import test from "node:test";
import assert from "node:assert/strict";
import { assertTeachingBoundary } from "../scripts/teaching-boundary.mjs";
const chunk = (fileName, imports = [], modules = {}, isEntry = false) => ({
  type: "chunk",
  fileName,
  imports,
  modules,
  isEntry,
});
test("build rejects PDF engines imported indirectly by initial UI code", () => {
  const bundle = {
    "app.js": chunk("app.js", ["ui.js"], {}, true),
    "ui.js": chunk("ui.js", ["pdf.js"]),
    "pdf.js": chunk("pdf.js", [], {
      "E:/project/node_modules/pdfjs-dist/build/pdf.mjs": {},
    }),
  };
  assert.throws(() => assertTeachingBoundary(bundle), /PDF code leaked/);
});
test("PDF engines remain permitted behind dynamic import boundaries", () => {
  const bundle = {
    "app.js": {
      ...chunk("app.js", ["ui.js"], {}, true),
      dynamicImports: ["pdf.js"],
    },
    "ui.js": chunk("ui.js"),
    "pdf.js": chunk("pdf.js", [], {
      "E:/project/node_modules/pdfjs-dist/build/pdf.mjs": {},
    }),
  };
  assert.doesNotThrow(() => assertTeachingBoundary(bundle));
});

test("build regression guard also recognizes Windows module paths", () => {
  const path = [
    "C:",
    "project",
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.mjs",
  ].join(String.fromCharCode(92));
  assert.throws(
    () =>
      assertTeachingBoundary({
        "app.js": chunk("app.js", [], { [path]: {} }, true),
      }),
    /PDF code leaked/,
  );
});

test("initial shell cannot statically import classroom or teaching runtime through shared chunks", () => {
  for (const module of [
    "account/community.jsx",
    "account/classroom-model.js",
    "teaching/TeachingRoom.jsx",
    "teaching/realtime-client.js",
  ]) {
    const bundle = {
      "app.js": chunk("app.js", ["shared.js"], {}, true),
      "shared.js": chunk("shared.js", [], {
        [`E:/project/src/features/${module}`]: {},
      }),
    };
    assert.throws(
      () => assertTeachingBoundary(bundle),
      /Classroom runtime leaked into the initial application/,
    );
  }
});
test("Settings and Profile cannot pull Class through a re-export or shared static dependency", () => {
  for (const [route, name] of [
    ["settings/learning.jsx", "Settings"],
    ["account/profile.jsx", "Profile"],
  ]) {
    const bundle = {
      "app.js": chunk("app.js", [], {}, true),
      "route.js": chunk("route.js", ["shared.js"], {
        [`E:/project/src/features/${route}`]: {},
      }),
      "shared.js": chunk("shared.js", [], {
        "E:/project/src/features/account/community.jsx": {},
      }),
    };
    assert.throws(
      () => assertTeachingBoundary(bundle),
      new RegExp(`Classroom runtime leaked into the ${name} route`),
    );
  }
});
test("pure public route matching stays in shell while Class, teaching and PDF stay lazy", () => {
  const bundle = {
    "app.js": {
      ...chunk(
        "app.js",
        [],
        { "E:/project/src/features/teaching/public-route.js": {} },
        true,
      ),
      dynamicImports: ["class.js", "settings.js", "profile.js"],
    },
    "class.js": {
      ...chunk("class.js", [], {
        "E:/project/src/features/account/community.jsx": {},
      }),
      dynamicImports: ["teaching.js"],
    },
    "settings.js": chunk("settings.js", [], {
      "E:/project/src/features/settings/learning.jsx": {},
    }),
    "profile.js": chunk("profile.js", [], {
      "E:/project/src/features/account/profile.jsx": {},
    }),
    "teaching.js": {
      ...chunk("teaching.js", [], {
        "E:/project/src/features/teaching/TeachingRoom.jsx": {},
      }),
      dynamicImports: ["whiteboard.js"],
    },
    "whiteboard.js": {
      ...chunk("whiteboard.js", [], {
        "E:/project/src/features/teaching/Whiteboard.jsx": {},
      }),
      dynamicImports: ["pdf.js"],
    },
    "pdf.js": chunk("pdf.js", [], {
      "E:/project/node_modules/pdfjs-dist/build/pdf.mjs": {},
    }),
  };
  assert.doesNotThrow(() => assertTeachingBoundary(bundle));
});
