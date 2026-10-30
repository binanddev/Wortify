import test from "node:test";
import assert from "node:assert/strict";
import { createBoardRealtime } from "../src/features/teaching/realtime-client.js";
async function fixture({
  enabled = true,
  requestOverride,
  url = "/board/",
} = {}) {
  let clock = 1000000,
    id = 0;
  const timers = new Map(),
    sockets = [],
    states = [],
    events = [],
    requests = [];
  class Socket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      sockets.push(this);
    }
    send(value) {
      this.sent.push(JSON.parse(value));
    }
    open() {
      this.readyState = 1;
      this.onopen();
    }
    message(value) {
      this.onmessage({ data: JSON.stringify(value) });
    }
    close(code = 1006) {
      this.readyState = 3;
      this.onclose?.({ code });
    }
  }
  const client = createBoardRealtime({
    url,
    request: async (...args) => {
      requests.push(args);
      return requestOverride
        ? requestOverride(...args)
        : {
            enabled,
            url: "wss://relay.example/ws",
            ticket: { data: "ticket" },
          };
    },
    onEvent: (event) => events.push(event),
    onState: (state) => states.push(state),
    WebSocketImpl: Socket,
    now: () => clock,
    random: () => 0.5,
    setTimer(fn, delay) {
      timers.set(++id, { fn, due: clock + delay });
      return id;
    },
    clearTimer(key) {
      timers.delete(key);
    },
  });
  const settle = async () => {
    for (let i = 0; i < 15; i++) await Promise.resolve();
  };
  await settle();
  return {
    client,
    sockets,
    states,
    events,
    requests,
    timers,
    async advance() {
      const [key, entry] = [...timers].sort((a, b) => a[1].due - b[1].due)[0];
      clock = entry.due;
      timers.delete(key);
      entry.fn();
      await settle();
    },
    ready() {
      const socket = sockets.at(-1);
      socket.open();
      socket.message({
        type: "ready",
        expires: Math.floor(clock / 1000) + 60,
        revision: 0,
      });
      return socket;
    },
    settle,
  };
}
test("auth uses a message, queued committed proofs flush after ready, and cleanup stops all work", async () => {
  const f = await fixture();
  assert.equal(f.sockets[0].url, "wss://relay.example/ws");
  f.client.publish({ data: "signed-event" });
  const ws = f.ready();
  assert.equal(ws.sent[0].type, "auth");
  assert.equal(ws.sent[1].type, "publish");
  assert.equal(f.states.at(-1), "live");
  assert.equal(f.events[0].type, "resync");
  ws.message({ type: "batch", revision: 1, operations: [] });
  assert.equal(f.events.at(-1).type, "batch");
  f.client.close();
  assert.equal(f.timers.size, 0);
  assert.equal(f.requests.length, 1);
});
test("missing relay config creates no sockets and schedules no rapid retries", async () => {
  const f = await fixture({ enabled: false });
  assert.equal(f.sockets.length, 0);
  assert.equal(f.requests.length, 1);
  assert.equal(f.states.at(-1), "fallback");
  assert.equal(f.timers.size, 0);
  f.client.close();
});
test("an interrupted connection reconnects with a fresh membership ticket", async () => {
  const f = await fixture(),
    ws = f.ready();
  ws.close(1006);
  assert.equal(f.states.at(-1), "fallback");
  await f.advance();
  assert.equal(f.requests.length, 2);
  assert.equal(f.sockets.length, 2);
  f.ready();
  f.client.close();
});
test("access is renewed before the old short-lived ticket expires", async () => {
  const f = await fixture();
  f.ready();
  await f.advance();
  assert.equal(f.states.at(-1), "connecting");
  await f.advance();
  assert.equal(f.requests.length, 2);
  f.client.close();
});
test("closing during ticket acquisition cannot open a late websocket", async () => {
  let resolve;
  const f = await fixture({
    requestOverride: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  f.client.close();
  resolve({ enabled: true, url: "wss://relay.example/ws", ticket: {} });
  await f.settle();
  assert.equal(f.sockets.length, 0);
  assert.equal(f.timers.size, 0);
});

test("guest links obtain read-only tickets with GET, without a session mutation", async () => {
  const f = await fixture({
    url: "/api/de/classes/public/11111111-1111-4111-8111-111111111111/",
  });
  assert.equal(f.requests[0][1], "GET");
  assert.equal(f.requests[0][2], undefined);
  f.client.close();
});
test("revoked public access stops reconnects and notifies the read-only viewer", async () => {
  const f = await fixture();
  const ws = f.ready();
  ws.close(4003);
  assert.deepEqual(f.events.at(-1), { type: "access-denied", status: 404 });
  assert.equal(f.timers.size, 0);
  f.client.close();
});
test("denied ticket renewal does not keep retrying a disabled public link", async () => {
  const f = await fixture({
    requestOverride: () => {
      throw Object.assign(new Error("Not found"), { status: 404 });
    },
  });
  assert.deepEqual(f.events.at(-1), { type: "access-denied", status: 404 });
  assert.equal(f.timers.size, 0);
  f.client.close();
});

test("offline relay notifications are byte-bounded while preserving the latest committed revision", async () => {
  const f = await fixture();
  for (let i = 0; i < 30; i++)
    f.client.publish({ data: `${i}:` + "x".repeat(100000) });
  const socket = f.ready(),
    messages = socket.sent.filter((item) => item.type === "publish");
  assert.ok(messages.length < 30);
  assert.ok(
    messages.reduce((sum, item) => sum + JSON.stringify(item).length, 0) <=
      1024 * 1024,
  );
  assert.match(messages.at(-1).proof.data, /^29:/);
  f.client.close();
});
test("browser send backpressure retains the notification for a fresh connection instead of growing its buffer", async () => {
  const f = await fixture(),
    socket = f.ready();
  socket.bufferedAmount = 2 * 1024 * 1024;
  f.client.publish({ data: "saved" });
  assert.equal(f.states.at(-1), "fallback");
  await f.advance();
  const fresh = f.ready();
  assert.equal(fresh.sent.at(-1).proof.data, "saved");
  f.client.close();
});
test("a websocket send failure cannot escape into durable save handling", async () => {
  const f = await fixture(),
    socket = f.ready();
  socket.send = () => {
    throw new Error("socket closed");
  };
  assert.doesNotThrow(() => f.client.publish({ data: "already-saved" }));
  await f.advance();
  const fresh = f.ready();
  assert.equal(fresh.sent.at(-1).proof.data, "already-saved");
  f.client.close();
});
test("a closed board never queues or sends late acknowledgements", async () => {
  const f = await fixture(),
    socket = f.ready();
  f.client.close();
  const sent = socket.sent.length;
  f.client.publish({ data: "late" });
  assert.equal(socket.sent.length, sent);
  assert.equal(f.timers.size, 0);
});
