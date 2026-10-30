import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import {
  TeachingHub,
  verify,
  originAllowed,
  MAX_MESSAGE,
} from "../src/protocol.js";
import { createRealtimeServer } from "../src/server.js";
const secret = "test-only-shared-secret-12345678901234567890",
  room = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
function proof(scope, payload) {
  const data = Buffer.from(
    JSON.stringify({ v: 1, iat: 1000, exp: 1060, room, user: 7, ...payload }),
  ).toString("base64url");
  return {
    data,
    signature: createHmac("sha256", secret)
      .update(`wortify-teaching-${scope}.v1.${data}`)
      .digest("hex"),
  };
}
class Socket {
  constructor() {
    this.readyState = 1;
    this.bufferedAmount = 0;
    this.sent = [];
    this.closed = [];
  }
  send(value) {
    this.sent.push(JSON.parse(value));
  }
  close(...args) {
    this.closed.push(args);
    this.readyState = 3;
  }
}
function fixture() {
  let clock = 1000;
  const hub = new TeachingHub({ secret, now: () => clock });
  return {
    hub,
    advance(n) {
      clock += n;
    },
    join(write = false, target = room, user = 7) {
      const socket = new Socket();
      hub.add(socket);
      hub.receive(
        socket,
        Buffer.from(
          JSON.stringify({
            type: "auth",
            ticket: proof("ticket", { write, room: target, user }),
          }),
        ),
      );
      return socket;
    },
  };
}
function send(hub, socket, message) {
  hub.receive(socket, Buffer.from(JSON.stringify(message)));
}
const batch = {
  kind: "batch",
  revision: 1,
  batch: "33333333-3333-4333-8333-333333333333",
  operations: [{ kind: "active", page: "page" }],
};
test("valid committed events broadcast only within the authenticated room", () => {
  const { hub, join } = fixture(),
    teacher = join(true),
    student = join(),
    outsider = join(false, other);
  send(hub, teacher, { type: "publish", proof: proof("event", batch) });
  assert.equal(student.sent.at(-1).type, "batch");
  assert.equal(student.sent.at(-1).revision, 1);
  assert.equal(teacher.sent.length, 1);
  assert.equal(outsider.sent.length, 1);
  send(hub, teacher, { type: "publish", proof: proof("event", batch) });
  assert.equal(
    student.sent.length,
    2,
    "duplicate proof is not broadcast twice",
  );
});
test("students cannot publish, even with an authentic committed event", () => {
  const { hub, join } = fixture(),
    student = join();
  send(hub, student, { type: "publish", proof: proof("event", batch) });
  assert.equal(student.closed[0][0], 1008);
});
test("tampered, cross-scope, cross-room and cross-user proofs are rejected", () => {
  for (const make of [
    () => ({ ...proof("event", batch), signature: "0".repeat(64) }),
    () => proof("ticket", { ...batch, write: true }),
    () => proof("event", { ...batch, room: other }),
    () => proof("event", { ...batch, user: 8 }),
  ]) {
    const { hub, join } = fixture(),
      teacher = join(true);
    send(hub, teacher, { type: "publish", proof: make() });
    assert.equal(teacher.closed[0][0], 1008);
  }
});
test("expired membership is removed even from an idle room", () => {
  const f = fixture(),
    student = f.join();
  f.advance(60);
  f.hub.sweep();
  assert.equal(student.closed[0][0], 4001);
  f.hub.remove(student);
  assert.equal(f.hub.rooms.size, 0);
});
test("oversized messages and slow clients are bounded", () => {
  const { hub, join } = fixture(),
    teacher = join(true),
    student = join();
  student.bufferedAmount = 2 * 1024 * 1024;
  send(hub, teacher, { type: "publish", proof: proof("event", batch) });
  assert.equal(student.closed[0][0], 1013);
  const bad = join(true);
  hub.receive(bad, Buffer.alloc(MAX_MESSAGE + 1));
  assert.equal(bad.closed[0][0], 1008);
});
test("future and expired tickets cannot authenticate", () => {
  assert.throws(() =>
    verify(proof("ticket", { write: true, exp: 1000 }), secret, "ticket", 1000),
  );
  assert.throws(() =>
    verify(
      proof("ticket", { write: true, iat: 1100, exp: 1160 }),
      secret,
      "ticket",
      1000,
    ),
  );
});
test("missing/untrusted origins, wildcard origins and weak config fail closed", () => {
  assert.equal(
    originAllowed(undefined, new Set(["https://class.example"])),
    false,
  );
  assert.equal(
    originAllowed("https://evil.example", new Set(["https://class.example"])),
    false,
  );
  assert.throws(() => createRealtimeServer({ secret, origins: ["*"] }));
  assert.throws(() => new TeachingHub({ secret: "short" }));
  assert.throws(() => new TeachingHub({ secret, maxConnections: NaN }));
  const service = createRealtimeServer({
    secret,
    origins: ["https://class.example"],
  });
  assert.equal(
    service.server.listening,
    false,
    "code-only test never starts a listening web server",
  );
  service.close();
});
test("PDF invalidation is signed and triggers a snapshot refresh for members", () => {
  const { hub, join } = fixture(),
    teacher = join(true),
    student = join();
  send(hub, teacher, {
    type: "publish",
    proof: proof("event", { kind: "invalidate", revision: 5 }),
  });
  assert.deepEqual(student.sent.at(-1), { type: "invalidate", revision: 5 });
});

import { readFile } from "node:fs/promises";
test("Django Python signing is interoperable with the standalone Node verifier", async () => {
  const proof = JSON.parse(
    await readFile(
      new URL("./signature-fixture.json", import.meta.url),
      "utf8",
    ),
  );
  const decoded = verify(proof, secret, "ticket", 1000);
  assert.equal(decoded.room, room);
  assert.equal(decoded.write, true);
});

function guest(hub, access = 1) {
  const socket = new Socket();
  hub.add(socket);
  send(hub, socket, {
    type: "auth",
    ticket: proof("ticket", { user: 0, write: false, public: true, access }),
  });
  return socket;
}
test("public guests receive only the enabled sharing version and cannot publish", () => {
  const { hub, join } = fixture(),
    teacher = join(true),
    viewer = guest(hub);
  send(hub, teacher, {
    type: "publish",
    proof: proof("event", { ...batch, public_access: 1 }),
  });
  assert.equal(viewer.sent.at(-1).type, "batch");
  send(hub, viewer, {
    type: "publish",
    proof: proof("event", { ...batch, public_access: 1 }),
  });
  assert.equal(viewer.closed[0][0], 1008);
});
test("disabling or rotating sharing closes guests before the next private update", () => {
  for (const access of [null, 2]) {
    const { hub, join } = fixture(),
      teacher = join(true),
      viewer = guest(hub);
    send(hub, teacher, {
      type: "publish",
      proof: proof("event", {
        kind: "invalidate",
        revision: 2,
        public_access: access,
      }),
    });
    assert.equal(viewer.closed[0][0], 4003);
    assert.equal(viewer.sent.length, 1, "no private event reaches the guest");
    const stale = guest(hub, 1);
    assert.equal(stale.closed[0][0], 4003);
  }
});
test("anonymous write tickets and event signatures are never accepted", () => {
  assert.throws(() =>
    verify(
      proof("ticket", { user: 0, write: true, public: true, access: 1 }),
      secret,
      "ticket",
      1000,
    ),
  );
  assert.throws(() =>
    verify(
      proof("event", {
        user: 0,
        write: false,
        public: true,
        access: 1,
        ...batch,
      }),
      secret,
      "event",
      1000,
    ),
  );
});

test("launcher health identifies this exact local key and guest protocol without listening", () => {
  const service = createRealtimeServer({
    secret,
    origins: ["http://127.0.0.1:5173"],
  });
  let body, status;
  service.server.emit(
    "request",
    { method: "GET", url: "/healthz" },
    {
      setHeader() {},
      writeHead(value) {
        status = value;
      },
      end(value) {
        body = JSON.parse(value);
      },
    },
  );
  assert.equal(status, 200);
  assert.equal(body.protocol, "teaching-v2-public");
  assert.deepEqual(body.origins, ["http://127.0.0.1:5173"]);
  assert.equal(
    body.key_id,
    createHash("sha256").update(secret).digest("hex").slice(0, 16),
  );
  service.close();
});

test("one broadcast serializes vector data once for the entire classroom", () => {
  const { hub, join } = fixture(),
    teacher = join(true);
  const viewers = Array.from({ length: 100 }, () => join());
  const message = Buffer.from(
    JSON.stringify({ type: "publish", proof: proof("event", batch) }),
  );
  const stringify = JSON.stringify;
  let batches = 0;
  JSON.stringify = function (value, ...rest) {
    if (value?.type === "batch") batches++;
    return stringify.call(this, value, ...rest);
  };
  try {
    hub.receive(teacher, message);
  } finally {
    JSON.stringify = stringify;
  }
  assert.equal(batches, 1);
  assert.ok(viewers.every((viewer) => viewer.sent.at(-1).revision === 1));
});
test("a failing recipient does not disconnect the teacher or block other viewers", () => {
  const { hub, join } = fixture(),
    teacher = join(true),
    broken = join(),
    healthy = join();
  broken.send = () => {
    throw Error("Connection failed");
  };
  send(hub, teacher, { type: "publish", proof: proof("event", batch) });
  assert.equal(broken.closed[0][0], 1011);
  assert.equal(teacher.closed.length, 0);
  assert.equal(healthy.sent.at(-1).revision, 1);
});

test("backpressure includes the next vector packet in the one MiB limit", () => {
  const { hub, join } = fixture(),
    teacher = join(true),
    student = join();
  student.bufferedAmount = 1024 * 1024 - 1;
  send(hub, teacher, { type: "publish", proof: proof("event", batch) });
  assert.equal(student.closed[0][0], 1013);
  assert.equal(student.sent.length, 1);
});
