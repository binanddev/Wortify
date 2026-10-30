import { createHmac, timingSafeEqual } from "node:crypto";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const MAX_MESSAGE = 384 * 1024;
export function verify(
  proof,
  secret,
  scope,
  now = Math.floor(Date.now() / 1000),
) {
  if (
    !proof ||
    typeof proof.data !== "string" ||
    typeof proof.signature !== "string" ||
    proof.data.length > MAX_MESSAGE ||
    !/^[A-Za-z0-9_-]+$/.test(proof.data) ||
    !/^[a-f0-9]{64}$/.test(proof.signature)
  )
    throw Error("Invalid proof");
  const expected = createHmac("sha256", secret)
    .update(`wortify-teaching-${scope}.v1.${proof.data}`)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(proof.signature, "hex")))
    throw Error("Invalid signature");
  const value = JSON.parse(
    Buffer.from(proof.data, "base64url").toString("utf8"),
  );
  if (
    value.v !== 1 ||
    !UUID.test(value.room) ||
    !Number.isSafeInteger(value.user) ||
    (value.user <= 0 &&
      !(
        scope === "ticket" &&
        value.user === 0 &&
        value.public === true &&
        value.write === false &&
        Number.isSafeInteger(value.access) &&
        value.access > 0
      )) ||
    !Number.isSafeInteger(value.iat) ||
    !Number.isSafeInteger(value.exp) ||
    value.iat > now + 5 ||
    value.exp <= now ||
    value.exp - value.iat > 90 ||
    value.exp <= value.iat
  )
    throw Error("Expired or invalid proof");
  return value;
}
export function originAllowed(origin, allowed) {
  return typeof origin === "string" && allowed.has(origin);
}
export class TeachingHub {
  constructor({
    secret,
    now = () => Math.floor(Date.now() / 1000),
    maxConnections = 1000,
  }) {
    if (typeof secret !== "string" || secret.length < 32)
      throw Error(
        "TEACHING_REALTIME_SECRET must contain at least 32 characters",
      );
    if (
      !Number.isSafeInteger(maxConnections) ||
      maxConnections < 1 ||
      maxConnections > 10000
    )
      throw Error("MAX_CONNECTIONS must be between 1 and 10000");
    this.secret = secret;
    this.now = now;
    this.maxConnections = maxConnections;
    this.peers = new Map();
    this.rooms = new Map();
  }
  add(socket) {
    if (this.peers.size >= this.maxConnections) {
      socket.close(1013, "Server is busy");
      return false;
    }
    this.peers.set(socket, { ticket: null, window: this.now(), count: 0 });
    return true;
  }
  remove(socket) {
    const peer = this.peers.get(socket);
    if (peer?.ticket) {
      const room = this.rooms.get(peer.ticket.room);
      room?.sockets.delete(socket);
      if (!room?.sockets.size) this.rooms.delete(peer.ticket.room);
    }
    this.peers.delete(socket);
  }
  send(socket, value) {
    this.sendRaw(socket, JSON.stringify(value));
  }
  sendRaw(socket, payload, bytes = Buffer.byteLength(payload)) {
    if (socket.readyState !== 1) return;
    if (socket.bufferedAmount + bytes > 1024 * 1024) {
      socket.close(1013, "Client is too slow");
      return;
    }
    try {
      socket.send(payload);
    } catch {
      // One disconnected/failed recipient must not abort the whole broadcast.
      socket.close(1011, "Unable to deliver classroom update");
    }
  }
  receive(socket, raw) {
    const peer = this.peers.get(socket);
    if (!peer) return;
    try {
      if (raw.length > MAX_MESSAGE || (!peer.ticket && raw.length > 8192))
        throw Error("Message too large");
      const now = this.now();
      if (now - peer.window >= 10) {
        peer.window = now;
        peer.count = 0;
      }
      if (++peer.count > 240) throw Error("Rate limit");
      const message = JSON.parse(raw.toString());
      if (!peer.ticket) {
        if (message.type !== "auth") throw Error("Authentication required");
        const ticket = verify(message.ticket, this.secret, "ticket", now);
        if (typeof ticket.write !== "boolean") throw Error("Invalid role");
        peer.ticket = ticket;
        if (!this.rooms.has(ticket.room))
          this.rooms.set(ticket.room, { revision: 0, sockets: new Set() });
        const room = this.rooms.get(ticket.room);
        if (
          ticket.public &&
          room.publicAccess !== undefined &&
          ticket.access !== room.publicAccess
        ) {
          socket.close(4003, "Public sharing changed");
          return;
        }
        room.sockets.add(socket);
        this.send(socket, {
          type: "ready",
          revision: room.revision,
          expires: ticket.exp,
        });
        return;
      }
      if (peer.ticket.exp <= now) {
        socket.close(4001, "Renew classroom access");
        return;
      }
      if (message.type !== "publish" || !peer.ticket.write)
        throw Error("Read only");
      const event = verify(message.proof, this.secret, "event", now);
      if (
        event.room !== peer.ticket.room ||
        event.user !== peer.ticket.user ||
        !Number.isSafeInteger(event.revision) ||
        event.revision < 1 ||
        !["batch", "invalidate"].includes(event.kind)
      )
        throw Error("Invalid event");
      if (
        event.kind === "batch" &&
        (!UUID.test(event.batch) ||
          !Array.isArray(event.operations) ||
          event.operations.length < 1 ||
          event.operations.length > 128)
      )
        throw Error("Invalid batch");
      const room = this.rooms.get(event.room);
      if (event.revision <= room.revision) return;
      room.revision = event.revision;
      if (Object.hasOwn(event, "public_access"))
        room.publicAccess = event.public_access;
      const update =
        event.kind === "batch"
          ? {
              type: "batch",
              revision: event.revision,
              batch: event.batch,
              operations: event.operations,
            }
          : { type: "invalidate", revision: event.revision };
      const payload = JSON.stringify(update),
        bytes = Buffer.byteLength(payload);
      for (const target of room.sockets) {
        const member = this.peers.get(target);
        if (member.ticket.public && member.ticket.access !== room.publicAccess)
          target.close(4003, "Public sharing changed");
        else if (member.ticket.exp <= now)
          target.close(4001, "Renew classroom access");
        else if (target !== socket) this.sendRaw(target, payload, bytes);
      }
    } catch {
      socket.close(1008, "Invalid classroom message");
    }
  }
  sweep() {
    const now = this.now();
    for (const [socket, peer] of this.peers)
      if (peer.ticket && peer.ticket.exp <= now)
        socket.close(4001, "Renew classroom access");
  }
}
