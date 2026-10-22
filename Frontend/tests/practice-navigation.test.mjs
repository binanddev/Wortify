import test from "node:test";
import assert from "node:assert/strict";
import {
  practiceFolders,
  myPracticeNodes,
  workspaceNodes,
  catalogRoots,
  workspaceRoots,
  toggleWorkspaceRoot,
  supportedPracticeNodes,
  ownedPracticeNodes,
  folderItems,
  practiceRoutes,
  legacyPracticeDestination,
} from "../src/features/practice/practice-navigation.js";

const nodes = [
  { id: 1, title: "Folder", kind: "folder", parent: null, can_edit: true },
  {
    id: 2,
    title: "My exercise",
    kind: "exercise",
    parent: 1,
    can_edit: true,
    payload: { presentation: { interaction: "short_answer" } },
  },
  {
    id: 3,
    title: "Shared exercise",
    kind: "exercise",
    parent: null,
    can_edit: false,
    payload: { presentation: { interaction: "matching" } },
  },
  {
    id: 4,
    title: "Old audio",
    kind: "exercise",
    parent: null,
    can_edit: true,
    payload: { presentation: { interaction: "audio_dictation" } },
  },
];
test("learning includes shared exercises while studio only manages owned supported content", () => {
  assert.deepEqual(
    supportedPracticeNodes(nodes).map((n) => n.id),
    [1, 2, 3],
  );
  assert.deepEqual(
    ownedPracticeNodes(nodes).map((n) => n.id),
    [1, 2],
  );
});
test("studio folder navigation and search preserve scope", () => {
  const owned = ownedPracticeNodes(nodes);
  assert.deepEqual(
    folderItems(owned, null).map((n) => n.id),
    [1],
  );
  assert.deepEqual(
    folderItems(owned, 1).map((n) => n.id),
    [2],
  );
  assert.deepEqual(
    folderItems(owned, null, "EXERCISE").map((n) => n.id),
    [2],
  );
});
test("authoring and guidance have dedicated routes; old creation links redirect out of Practice Hub", () => {
  for (const lang of ["en", "de"]) {
    const routes = practiceRoutes(lang);
    assert.equal(routes.learn, `/${lang}/practice`);
    assert.equal(routes.create, `/${lang}/create/new`);
    assert.equal(routes.guide, `/${lang}/create/guide`);
    assert.equal(
      legacyPracticeDestination(lang, "practice", "new"),
      routes.create,
    );
    assert.equal(
      legacyPracticeDestination(lang, "practice", "guide"),
      routes.guide,
    );
    assert.equal(legacyPracticeDestination(lang, "practice", "42"), null);
    assert.equal(
      legacyPracticeDestination(lang, "exercise-studio", "new"),
      null,
    );
  }
});

test("workspace is opt-in, includes folder descendants, and never invents inaccessible items", () => {
  assert.deepEqual(workspaceNodes(nodes, []), []);
  assert.deepEqual(
    workspaceNodes(nodes, [1, 2, 999]).map((n) => n.id),
    [1, 2],
  );
  assert.equal(workspaceNodes(nodes, [2])[0].parent, null);
  assert.equal(workspaceNodes(nodes, [1, 2])[1].parent, 1);
  assert.deepEqual(
    workspaceNodes(
      nodes.filter((n) => n.id !== 2),
      [2],
    ),
    [],
  );
});

test("catalog and pins resolve nested matches to accessible roots", () => {
  const tree = [
    ...nodes,
    { id: 5, kind: "folder", parent: 1, title: "Nested" },
    { id: 6, kind: "exercise", parent: 5, title: "Grammar" },
    { id: 7, kind: "exercise", parent: 999, title: "Shared orphan" },
  ];
  assert.deepEqual(
    catalogRoots(tree, "Grammar").map((n) => n.id),
    [1],
  );
  assert.deepEqual(
    catalogRoots(tree).map((n) => n.id),
    [1, 3, 4, 7],
  );
  assert.deepEqual(workspaceRoots(tree, [6, 5, 2, 1, 7, 999]), [1, 7]);
  assert.deepEqual(toggleWorkspaceRoot(tree, [6, 7], 2), [7]);
  assert.deepEqual(toggleWorkspaceRoot(tree, [7], 6), [7, 1]);
  assert.deepEqual(
    workspaceNodes(tree, [6]).map((n) => n.id),
    [1, 2, 5, 6],
  );
});

test("folder explorer hides lessons, resolves missing parents and retains nested content search paths", () => {
  const tree = [...nodes, {id:5, kind:"folder", parent:1, title:"Nested"}, {id:6,kind:"theory",parent:5,title:"Travel notes"}, {id:7,kind:"folder",parent:999,title:"Shared branch"}];
  assert.deepEqual(practiceFolders(tree).map(folder=>folder.id),[1,5,7]);
  assert.equal(practiceFolders(tree).find(folder=>folder.id===7).parent_id,null);
  assert.deepEqual(practiceFolders(tree,"TRAVEL").map(folder=>folder.id),[1,5]);
  assert.deepEqual(practiceFolders(tree,"Shared exercise"),[]);
  assert.deepEqual(practiceFolders(tree,"missing"),[]);
});
test("folder search terminates on cycles and never invents inaccessible ancestors", () => {
  const tree = [{id:1,kind:"folder",parent:2,title:"A"},{id:2,kind:"folder",parent:1,title:"B"},{id:3,kind:"exercise",parent:1,title:"Match"}];
  assert.deepEqual(practiceFolders(tree,"Match").map(folder=>folder.id),[1,2]);
});

test("personal catalogue includes unpinned own/copied roots, hides public-only nodes and resolves nested search to roots", () => {
 const tree = [...nodes, {id:10,kind:"folder",title:"Copied folder",parent:null,can_edit:true}, {id:11,kind:"folder",title:"Copied child",parent:10,can_edit:true}, {id:12,kind:"folder",title:"Public folder",parent:null,can_edit:false}];
 const personal = ownedPracticeNodes(tree);
 assert.deepEqual(catalogRoots(personal).map(n=>n.id),[1,10]);
 assert.deepEqual(catalogRoots(personal,"Copied child").map(n=>n.id),[10]);
 assert.deepEqual(workspaceNodes(personal,[]),[]);
});


test("My practice always includes every personal root and descendant without saved pins", () => {
 const tree = [...nodes, {id:10,kind:"folder",parent:null,title:"Unpinned root",can_edit:true}, {id:11,kind:"folder",parent:10,title:"Child",can_edit:true}, {id:12,kind:"theory",parent:11,title:"Lesson",can_edit:true}, {id:13,kind:"folder",parent:null,title:"Public only",can_edit:false}];
 assert.deepEqual(myPracticeNodes(tree).map(n=>n.id),[1,2,10,11,12]);
 assert.deepEqual(catalogRoots(ownedPracticeNodes(tree)).map(n=>n.id),[1,10]);
 assert.deepEqual(myPracticeNodes(tree,[3]).map(n=>n.id),[1,2,3,10,11,12]);
 assert.equal(myPracticeNodes(tree).find(n=>n.id===11).parent,10);
 assert.equal(myPracticeNodes(tree).find(n=>n.id===12).parent,11);
});
