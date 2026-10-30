// Guard the load boundary, not chunk names: shared chunks can accidentally pull
// Class/PDF code into the shell or unrelated Settings/Profile routes.
const normalize = (id) =>
  id.replaceAll(String.fromCharCode(92), "/").split("?")[0];
const pdfEngine = (id) =>
  /\/node_modules\/(?:pdfjs-dist|pdf-lib|@pdf-lib)\//.test(id);
const classroomRuntime = (id) =>
  (/\/src\/features\/teaching\//.test(id) &&
    !id.endsWith("/public-route.js")) ||
  /\/src\/features\/account\/(?:community\.jsx|classroom(?:[-./]))/.test(id);
const protectedRoute = (id) => {
  if (id.endsWith("/src/features/settings/learning.jsx")) return "Settings";
  if (id.endsWith("/src/features/account/profile.jsx")) return "Profile";
  return null;
};

export function assertTeachingBoundary(bundle) {
  function check(root, label) {
    const seen = new Set();
    function visit(file) {
      if (seen.has(file)) return;
      const item = bundle[file];
      if (item?.type !== "chunk") return;
      seen.add(file);
      for (const moduleId of Object.keys(item.modules || {})) {
        const id = normalize(moduleId);
        if (pdfEngine(id))
          throw Error(`PDF code leaked into ${label}: ${file}`);
        if (classroomRuntime(id))
          throw Error(`Classroom runtime leaked into ${label}: ${file}`);
      }
      // Dynamic imports are intentionally excluded: they are feature entry points.
      for (const next of item.imports || []) visit(next);
    }
    visit(root);
  }
  for (const item of Object.values(bundle)) {
    if (item.type !== "chunk") continue;
    if (item.isEntry) check(item.fileName, "the initial application");
    const labels = new Set(
      Object.keys(item.modules || {})
        .map((id) => protectedRoute(normalize(id)))
        .filter(Boolean),
    );
    for (const label of labels) check(item.fileName, `the ${label} route`);
  }
}
export function teachingBoundary() {
  return {
    name: "teaching-lazy-boundary",
    apply: "build",
    generateBundle(options, bundle) {
      assertTeachingBoundary(bundle);
    },
  };
}
