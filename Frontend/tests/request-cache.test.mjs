import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  request,
  clearContentCache,
  primeContentCache,
} from "../src/lib/request.js";
const path = "/api/de/decks/1/";
const response = (data) => ({ ok: true, json: async () => data });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
beforeEach(() => {
  clearContentCache();
  globalThis.document = { cookie: "" };
});
test("concurrent readers share one fetch and receive independent objects", async () => {
  const pending = deferred();
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    return pending.promise;
  };
  const a = request(path),
    b = request(path);
  pending.resolve(response({ cards: [{ id: 1 }] }));
  const [first, second] = await Promise.all([a, b]);
  first.cards[0].id = 99;
  assert.equal(second.cards[0].id, 1);
  assert.equal((await request(path)).cards[0].id, 1);
  assert.equal(calls, 1);
});
test("one consumer abort does not cancel another reader", async () => {
  const pending = deferred();
  let sharedSignal;
  globalThis.fetch = (_, options) => {
    sharedSignal = options.signal;
    return pending.promise;
  };
  const controller = new AbortController();
  const first = request(path, "GET", undefined, controller.signal),
    second = request(path);
  controller.abort();
  await assert.rejects(first, { name: "AbortError" });
  assert.equal(sharedSignal.aborted, false);
  pending.resolve(response({ id: 1 }));
  assert.equal((await second).id, 1);
});
test("last reader abort cancels transport and next reader starts fresh", async () => {
  let calls = 0,
    firstSignal;
  const pending = deferred();
  globalThis.fetch = (_, options) => {
    calls++;
    if (calls === 1) {
      firstSignal = options.signal;
      return pending.promise;
    }
    return Promise.resolve(response({ id: 2 }));
  };
  const controller = new AbortController();
  const first = request(path, "GET", undefined, controller.signal);
  controller.abort();
  await assert.rejects(first, { name: "AbortError" });
  assert.equal(firstSignal.aborted, true);
  assert.equal((await request(path)).id, 2);
  pending.resolve(response({ id: 1 }));
  assert.equal(calls, 2);
});
test("response from before a mutation cannot poison the refreshed cache", async () => {
  const pending = deferred();
  let reads = 0;
  globalThis.fetch = (_, options) =>
    options.method === "GET"
      ? ++reads === 1
        ? pending.promise
        : Promise.resolve(response({ version: 2 }))
      : Promise.resolve(response({ ok: true }));
  const old = request(path);
  await request(path, "PATCH", { title: "new" });
  assert.equal((await request(path)).version, 2);
  pending.resolve(response({ version: 1 }));
  await old;
  assert.equal((await request(path)).version, 2);
  assert.equal(reads, 2);
});
test("clearing account cache prevents pending responses from repopulating it", async () => {
  const pending = deferred();
  globalThis.fetch = () => pending.promise;
  const old = request(path);
  clearContentCache();
  pending.resolve(response({ owner: "old" }));
  await old;
  globalThis.fetch = async () => response({ owner: "new" });
  assert.equal((await request(path)).owner, "new");
});
test("learning sync invalidates deck lists and study packs as well as details", async () => {
  const paths = [path, "/api/de/decks/", "/api/de/study-pack/?filter=due"];
  paths.forEach((p) => primeContentCache(p, { stale: true }));
  globalThis.fetch = async () => response({ fresh: true });
  await request("/api/de/learning/sync/", "POST", { events: [{kind:'review',payload:{deck:1}}] });
  for (const p of paths) assert.equal((await request(p)).fresh, true);
});

test("new session response is reused without another request", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response({ token: "session-1", cards: [] });
  };
  await request("/api/de/sessions/", "POST", {});
  assert.equal(
    (await request("/api/de/sessions/session-1/")).token,
    "session-1",
  );
  assert.equal(calls, 1);
});


test('a review preserves other decks, languages and Practice content', async () => {
  const untouched = ['/api/de/decks/2/', '/api/en/decks/1/', '/api/de/practice-hub/nodes/', '/api/de/practice-hub/nodes/7/'];
  for (const key of [...untouched,path]) primeContentCache(key,{version:1});
  globalThis.fetch = async () => response({version:2});
  await request('/api/de/learning/sync/','POST',{events:[{kind:'review',payload:{deck:1}}]});
  for (const key of untouched) assert.equal((await request(key)).version,1,key);
  assert.equal((await request(path)).version,2);
});

test('Practice progress invalidates its metadata and lesson, preserving other lessons', async () => {
  const keys = ['/api/de/practice-hub/nodes/?scope=workspace','/api/de/practice-hub/nodes/7/','/api/de/practice-hub/nodes/8/',path];
  keys.forEach(key=>primeContentCache(key,{version:1}));
  globalThis.fetch = async () => response({version:2});
  await request('/api/de/learning/sync/','POST',{events:[{kind:'practice_progress',payload:{node:7}}]});
  assert.equal((await request(keys[0])).version,2);
  assert.equal((await request(keys[1])).version,2);
  assert.equal((await request(keys[2])).version,1);
  assert.equal((await request(path)).version,1);
});

test('unrelated in-flight reads remain shared and cacheable during a sync', async () => {
  const pending=deferred();let reads=0;
  globalThis.fetch=(_,options)=>options.method==='GET'?(reads++,pending.promise):Promise.resolve(response({ok:true}));
  const key='/api/de/practice-hub/nodes/7/';
  const first=request(key);
  await request('/api/de/learning/sync/','POST',{events:[{kind:'review',payload:{deck:1}}]});
  const second=request(key);
  pending.resolve(response({version:1}));
  await Promise.all([first,second]);await request(key);
  assert.equal(reads,1);
});

test('a stale affected flight cannot overwrite post-sync data', async () => {
  const pending=deferred();let reads=0;
  globalThis.fetch=(_,options)=>options.method==='GET'?(++reads===1?pending.promise:Promise.resolve(response({version:2}))):Promise.resolve(response({ok:true}));
  const first=request(path);
  await request('/api/de/learning/sync/','POST',{events:[{kind:'star',payload:{deck:1}}]});
  assert.equal((await request(path)).version,2);
  pending.resolve(response({version:1}));await first;
  assert.equal((await request(path)).version,2);
});

test('empty sync and preference sync retain content', async () => {
  primeContentCache(path,{version:1});
  globalThis.fetch=async()=>response({version:2});
  await request('/api/de/learning/sync/','POST',{events:[]});
  await request('/api/de/learning/sync/','POST',{events:[{kind:'preferences',payload:{sound:false}}]});
  assert.equal((await request(path)).version,1);
});


test('CRUD revalidates mounted consumers while review sync only invalidates future reads', async () => {
  const previousWindow=globalThis.window;
  const events=[];
  globalThis.window={dispatchEvent:event=>events.push(event)};
  globalThis.fetch=async()=>response({ok:true});
  try {
    await request(path,'PATCH',{title:'Updated'});
    assert.equal(events.length,1);
    assert.equal(events[0].type,'content-cache-invalidated');
    assert.equal(events[0].detail.matches(path),true);
    assert.equal(events[0].detail.matches('/api/de/decks/2/'),false);
    await request('/api/de/learning/sync/','POST',{events:[{kind:'review',payload:{deck:1}}]});
    assert.equal(events.length,1);
  } finally {
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});

test("class creation, settings and assignments revalidate only Class in their own language", async () => {
  const previousWindow = globalThis.window,
    events = [];
  const untouched = [
    "/api/de/practice-hub/nodes/7/",
    "/api/de/practice-hub/nodes/?scope=workspace",
    "/api/de/reading/4/",
    "/api/de/decks/1/",
    "/api/de/decks/",
    "/api/de/study-pack/?filter=due",
    "/api/en/decks/1/",
  ];
  const classKeys = [
    "/api/de/classes/",
    "/api/de/classes/?filter=mine",
    "/api/de/classes/3/",
    "/api/de/classes/4/",
  ];
  globalThis.window = { dispatchEvent: (event) => events.push(event) };
  try {
    for (const [mutation, method, data] of [
      ["/api/de/classes/", "POST", { title: "New class" }],
      ["/api/de/classes/3/", "PATCH", { title: "Renamed" }],
      ["/api/de/classes/3/assignments/", "POST", { node: 7 }],
      ["/api/de/classes/3/assignments/", "DELETE", { id: 5 }],
    ]) {
      clearContentCache();
      events.length = 0;
      for (const key of untouched) primeContentCache(key, { preserved: true });
      let reads = 0;
      globalThis.fetch = async (_, options) => {
        if (options.method === "GET") reads++;
        return response({ fresh: true });
      };
      await request(mutation, method, data);
      for (const key of untouched)
        assert.equal(
          (await request(key)).preserved,
          true,
          `${mutation} must preserve ${key}`,
        );
      assert.equal(
        reads,
        0,
        "class operations must not refetch cached learning content",
      );
      assert.equal(events.length, 1);
      for (const key of classKeys)
        assert.equal(
          events[0].detail.matches(key),
          true,
          `mounted Class consumer ${key} must refresh`,
        );
      for (const key of [
        ...untouched,
        "/api/en/classes/",
        "/api/en/classes/3/",
      ])
        assert.equal(
          events[0].detail.matches(key),
          false,
          `${mutation} must not refresh ${key}`,
        );
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("assigning Class content leaves a shared in-flight Practice read usable and cacheable", async () => {
  const pending = deferred();
  let reads = 0;
  globalThis.fetch = (_, options) =>
    options.method === "GET"
      ? (reads++, pending.promise)
      : Promise.resolve(response({ ok: true }));
  const key = "/api/de/practice-hub/nodes/7/",
    first = request(key);
  await request("/api/de/classes/3/assignments/", "POST", { node: 7 });
  const second = request(key);
  pending.resolve(response({ version: 1 }));
  await Promise.all([first, second]);
  assert.equal((await request(key)).version, 1);
  assert.equal(reads, 1);
});

test("board mutations retain their exact-resource matcher instead of refreshing the class", async () => {
  const previousWindow = globalThis.window,
    events = [];
  globalThis.window = { dispatchEvent: (event) => events.push(event) };
  globalThis.fetch = async () => response({ revision: 1 });
  try {
    const board =
      "/api/de/classes/3/boards/11111111-1111-4111-8111-111111111111/";
    await request(board, "POST", { batch: "test", operations: [] });
    const matches = events[0].detail.matches;
    assert.equal(matches(board + "?since=1"), true);
    for (const key of [
      "/api/de/classes/",
      "/api/de/classes/3/",
      "/api/de/classes/3/boards/22222222-2222-4222-8222-222222222222/",
      "/api/en/classes/3/boards/11111111-1111-4111-8111-111111111111/",
      "/api/de/reading/4/",
    ])
      assert.equal(matches(key), false, key);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
