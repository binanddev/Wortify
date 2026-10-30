import { useEffect, useRef, useState } from "react";
import { request } from "../../lib/core.js";
import { applyOperation, uid, takeOperations } from "./board-model.js";
import { draftStore } from "./draft-store.js";
import { createBoardRealtime } from "./realtime-client.js";

export function useBoard(url, manage) {
  const model = useRef(null),
    revision = useRef(0),
    queue = useRef([]),
    flight = useRef(null),
    busy = useRef(false),
    alive = useRef(false),
    fatal = useRef(false),
    paused = useRef(false),
    wake = useRef(() => {}),
    relay = useRef(null),
    incoming = useRef([]),
    connection = useRef("connecting"),
    needsPull = useRef(false),
    lastPull = useRef(0),
    nextWrite = useRef(0),
    nextPull = useRef(0),
    failures = useRef(0),
    draftTimer = useRef(null),
    persistTail = useRef(Promise.resolve());
  const [version, bump] = useState(0),
    [status, setStatus] = useState("loading"),
    [error, setError] = useState(""),
    [warning, setWarning] = useState(""),
    [mode, setMode] = useState("connecting");
  const persist = (clearSaved = false) => {
    clearTimeout(draftTimer.current);
    draftTimer.current = null;
    const snapshot =
      clearSaved && !queue.current.length && !flight.current
        ? null
        : structuredClone({
            state: model.current,
            revision: revision.current,
            queue: queue.current,
            flight: flight.current,
          });
    // Preserve ordering so a slow older checkpoint cannot overwrite a newer ACK.
    persistTail.current = persistTail.current
      .then(() => draftStore(url, snapshot))
      .catch(() => {
        if (alive.current)
          setWarning(
            "Device storage is unavailable. Keep the board open until changes are saved.",
          );
      });
    return persistTail.current;
  };
  const checkpoint = () => {
    if (draftTimer.current === null)
      draftTimer.current = setTimeout(() => {
        draftTimer.current = null;
        persist();
      }, 250);
  };
  const refresh = () => bump((n) => n + 1);
  useEffect(() => {
    alive.current = true;
    let timer,
      controller = new AbortController();
    const active = () => alive.current && !controller.signal.aborted;
    function schedule(delay) {
      clearTimeout(timer);
      if (active() && !fatal.current)
        timer = setTimeout(tick, Math.max(0, delay));
    }
    wake.current = () => {
      if (!busy.current && !paused.current) schedule(0);
    };
    async function start() {
      try {
        const data = await request(
          url,
          "GET",
          undefined,
          AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        );
        const draft = manage ? await draftStore(url).catch(() => null) : null;
        if (!active()) return;
        model.current =
          draft && (draft.queue.length || draft.flight)
            ? draft.state
            : data.state;
        revision.current =
          draft && (draft.queue.length || draft.flight)
            ? draft.revision
            : data.revision;
        queue.current = draft?.queue || [];
        flight.current = draft?.flight || null;
        lastPull.current = Date.now();
        setError("");
        setStatus(queue.current.length || flight.current ? "saving" : "saved");
        refresh();
        relay.current = createBoardRealtime({
          url,
          request,
          onState(value) {
            if (!active()) return;
            connection.current = value;
            setMode(value);
            if (value === "live") {
              needsPull.current = true;
              wake.current();
            }
          },
          onEvent(event) {
            if (!active()) return;
            incoming.current.push(event);
            if (incoming.current.length > 64) {
              incoming.current = [];
              needsPull.current = true;
            }
            wake.current();
          },
        });
        tick();
      } catch (e) {
        if (active()) {
          const denied = !manage && [401, 403, 404].includes(e.status);
          setError(
            denied && url.includes("/classes/public/")
              ? "This public lesson is unavailable. The teacher may have stopped sharing."
              : e.message,
          );
          setStatus(
            denied
              ? "unavailable"
              : e.status >= 400 && e.status < 500
                ? "error"
                : "offline",
          );
          if (!e.status || e.status >= 500) timer = setTimeout(start, 2000);
        }
      }
    }
    function consume() {
      while (incoming.current.length) {
        const event = incoming.current.shift();
        if (event.type === "access-denied")
          throw Object.assign(
            new Error(
              url.includes("/classes/public/")
                ? "This public lesson is unavailable. The teacher may have stopped sharing."
                : "Lesson access ended",
            ),
            { status: event.status },
          );
        if (event.type === "resync") {
          needsPull.current = true;
          continue;
        }
        if (event.revision <= revision.current) continue;
        if (
          event.type === "invalidate" ||
          event.revision !== revision.current + 1 ||
          !Array.isArray(event.operations)
        ) {
          needsPull.current = true;
          continue;
        }
        if (queue.current.length || flight.current)
          throw Object.assign(
            new Error(
              "The board changed in another window. Reopen the lesson before continuing.",
            ),
            { status: 409 },
          );
        for (const op of event.operations) applyOperation(model.current, op);
        revision.current = event.revision;
        refresh();
      }
    }
    async function tick() {
      if (!active() || fatal.current || busy.current) return;
      try {
        if (paused.current) return;
        busy.current = true;
        consume();
        const signal = AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]);
        if (manage && (queue.current.length || flight.current)) {
          if (Date.now() < nextWrite.current) return;
          if (!flight.current)
            flight.current = {
              batch: uid(),
              revision: revision.current,
              operations: takeOperations(queue.current),
            };
          await persist();
          const result = await request(url, "POST", flight.current, signal);
          if (!active()) return;
          revision.current = result.revision;
          flight.current = null;
          nextWrite.current = Date.now() + 250;
          await persist(true);
          failures.current = 0;
          relay.current?.publish(result.notification);
        } else if (
          needsPull.current ||
          Date.now() - lastPull.current >=
            (connection.current === "live" ? 30000 : 10000)
        ) {
          if (Date.now() < nextPull.current) return;
          const data = await request(
            `${url}?since=${revision.current}`,
            "GET",
            undefined,
            signal,
          );
          if (!active()) return;
          if (manage && (queue.current.length || flight.current)) {
            if (data.revision !== revision.current)
              throw new Error(
                "The board changed in another window. Reopen the lesson before continuing.",
              );
          } else if (data.revision !== revision.current) {
            if (data.state) model.current = data.state;
            else
              for (const event of data.events)
                for (const op of event.operations)
                  applyOperation(model.current, op);
            revision.current = data.revision;
            refresh();
          }
          lastPull.current = Date.now();
          nextPull.current = 0;
          failures.current = 0;
          needsPull.current = data.events?.length === 64;
        }
        if (active()) {
          setStatus(
            queue.current.length || flight.current ? "saving" : "saved",
          );
          setError("");
        }
      } catch (e) {
        if (!active()) return;
        setError(e.message);
        setStatus("offline");
        const retryDelay = Math.min(
          30000,
          2000 * 2 ** Math.min(failures.current++, 4),
        );
        nextWrite.current = Date.now() + retryDelay;
        nextPull.current = Date.now() + retryDelay;
        if (
          (e.status >= 400 && e.status < 500 && e.status !== 429) ||
          /another window|Invalid|full|not found|Only the class|sign in|Reopen|coordinates|Stroke changed/.test(
            e.message,
          )
        ) {
          fatal.current = true;
          if ([401, 403, 404].includes(e.status)) {
            relay.current?.close();
            connection.current = "fallback";
            setMode("fallback");
          }
          if (!manage && [401, 403, 404].includes(e.status)) {
            model.current = null;
            incoming.current = [];
            refresh();
            setStatus("unavailable");
          } else setStatus("conflict");
        }
      } finally {
        busy.current = false;
        if (active() && !fatal.current)
          schedule(
            paused.current
              ? 1000
              : queue.current.length || flight.current
                ? Math.max(0, nextWrite.current - Date.now())
                : incoming.current.length || needsPull.current
                  ? Math.max(0, nextPull.current - Date.now())
                  : connection.current === "live"
                    ? 30000
                    : 10000,
          );
      }
    }
    start();
    const before = (e) => {
      if (queue.current.length || flight.current) {
        persist();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const visible = () => {
      if (!document.hidden) {
        nextPull.current = 0;
        nextWrite.current = 0;
        needsPull.current = true;
        wake.current();
      }
    };
    window.addEventListener("beforeunload", before);
    window.addEventListener("online", visible);
    document.addEventListener?.("visibilitychange", visible);
    return () => {
      alive.current = false;
      controller.abort();
      clearTimeout(timer);
      clearTimeout(draftTimer.current);
      draftTimer.current = null;
      if (manage && (queue.current.length || flight.current)) persist();
      relay.current?.close();
      relay.current = null;
      wake.current = () => {};
      window.removeEventListener("beforeunload", before);
      window.removeEventListener("online", visible);
      document.removeEventListener?.("visibilitychange", visible);
    };
  }, [url, manage]);
  function notify(proof) {
    relay.current?.publish(proof);
  }
  function dispatch(op) {
    if (!manage || !model.current || fatal.current) return false;
    const operations =
      op.kind === "visibility"
        ? Array.from({ length: Math.ceil(op.ids.length / 1024) }, (_, i) => ({
            ...op,
            ids: op.ids.slice(i * 1024, (i + 1) * 1024),
          }))
        : [op];
    for (const operation of operations) {
      applyOperation(model.current, operation);
      queue.current.push(operation);
    }
    setStatus("saving");
    refresh();
    checkpoint();
    wake.current();
    return true;
  }
  async function drain() {
    const deadline = Date.now() + 30000;
    while (queue.current.length || flight.current || busy.current) {
      if (fatal.current || Date.now() > deadline)
        throw new Error(
          "Wait for the board to finish saving before importing a PDF.",
        );
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    paused.current = true;
  }
  async function replace(data) {
    model.current = data.state;
    revision.current = data.revision;
    queue.current = [];
    flight.current = null;
    await persist();
    relay.current?.publish(data.notification);
    refresh();
  }
  async function reset() {
    const data = await request(url);
    queue.current = [];
    flight.current = null;
    incoming.current = [];
    fatal.current = false;
    await replace(data);
    setError("");
    setStatus("saved");
    wake.current();
  }
  return {
    model,
    notify,
    version,
    status,
    error,
    warning,
    mode,
    dispatch,
    drain,
    replace,
    reset,
    resume: () => {
      paused.current = false;
      wake.current();
    },
    pending: () => !!(queue.current.length || flight.current),
  };
}
