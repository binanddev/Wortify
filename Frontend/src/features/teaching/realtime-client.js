// Only opened by an active teaching board. The app shell never connects to the relay.
export function createBoardRealtime({
  url,
  request,
  onEvent,
  onState,
  WebSocketImpl = globalThis.WebSocket,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = Date.now,
  random = Math.random,
}) {
  let closed = false,
    socket = null,
    retryTimer,
    renewTimer,
    attempt = 0,
    ready = false,
    pendingBytes = 0;
  const controller = new AbortController(),
    pending = [];
  function schedule(delay) {
    clearTimer(retryTimer);
    if (!closed) retryTimer = setTimer(connect, delay);
  }
  const MAX_BUFFER = 1024 * 1024;
  function discardFirst() {
    const item = pending.shift();
    pendingBytes -= item.payload.length;
    return item;
  }
  function publish(proof) {
    if (closed || !proof) return;
    const payload = JSON.stringify({ type: "publish", proof });
    if (payload.length > 384 * 1024) return;
    pending.push({ payload, at: now() });
    pendingBytes += payload.length;
    // A later revision makes receivers resync gaps, so old notifications can be
    // dropped safely instead of retaining tens of MB while the relay is offline.
    while (pending.length > 64 || pendingBytes > MAX_BUFFER) discardFirst();
    flush();
  }
  function flush() {
    if (!ready || socket?.readyState !== 1) return;
    while (pending.length) {
      if ((socket.bufferedAmount || 0) > MAX_BUFFER) {
        socket.close(1013, "Realtime connection is too slow");
        return;
      }
      const item = pending[0];
      if (now() - item.at >= 45000) {
        discardFirst();
        continue;
      }
      try {
        socket.send(item.payload);
        discardFirst();
      } catch {
        socket.close();
        return;
      }
    }
  }
  async function connect() {
    if (closed) return;
    try {
      if (!WebSocketImpl) throw Error("WebSocket unavailable");
      const config = await request(
        `${url}realtime/`,
        url.includes("/classes/public/") ? "GET" : "POST",
        url.includes("/classes/public/") ? undefined : {},
        AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      );
      if (closed) return;
      if (!config.enabled) {
        onState("fallback");
        return;
      }
      const address = new URL(config.url);
      if (!["ws:", "wss:"].includes(address.protocol))
        throw Error("Invalid realtime address");
      const current = new WebSocketImpl(config.url);
      socket = current;
      let handshake = setTimer(() => current.close(), 10000);
      current.onopen = () => {
        if (closed || socket !== current) {
          current.close();
          return;
        }
        current.send(JSON.stringify({ type: "auth", ticket: config.ticket }));
      };
      current.onmessage = (event) => {
        if (
          closed ||
          socket !== current ||
          typeof event.data !== "string" ||
          event.data.length > 384 * 1024
        )
          return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === "ready") {
            if (
              !Number.isSafeInteger(message.expires) ||
              message.expires * 1000 <= now()
            )
              throw Error("Expired realtime session");
            clearTimer(handshake);
            attempt = 0;
            ready = true;
            onState("live");
            onEvent({ type: "resync" });
            flush();
            clearTimer(renewTimer);
            renewTimer = setTimer(
              () => current.close(4001, "Renew access"),
              Math.max(1000, message.expires * 1000 - now() - 5000),
            );
          } else if (
            ready &&
            ["batch", "invalidate"].includes(message.type) &&
            Number.isSafeInteger(message.revision) &&
            message.revision > 0
          )
            onEvent(message);
        } catch {
          current.close(1008, "Invalid realtime response");
        }
      };
      current.onerror = () => current.close();
      current.onclose = (event) => {
        if (event.code === 4003 && !closed) {
          closed = true;
          onEvent({ type: "access-denied", status: 404 });
        }
        clearTimer(handshake);
        clearTimer(renewTimer);
        if (closed || socket !== current) return;
        ready = false;
        onState(event.code === 4001 ? "connecting" : "fallback");
        schedule(
          event.code === 4001
            ? 200
            : Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)) *
                (0.8 + random() * 0.4),
        );
      };
    } catch (error) {
      if (closed) return;
      if ([401, 403, 404].includes(error.status)) {
        closed = true;
        onEvent({ type: "access-denied", status: error.status });
        return;
      }
      ready = false;
      onState("fallback");
      schedule(Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)));
    }
  }
  connect();
  return {
    publish,
    close() {
      closed = true;
      ready = false;
      controller.abort();
      clearTimer(retryTimer);
      clearTimer(renewTimer);
      socket?.close(1000, "Board closed");
      pending.length = 0;
      pendingBytes = 0;
    },
  };
}
