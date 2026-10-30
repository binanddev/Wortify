// Sequential, abortable list refreshes. Slow requests never overlap each other.
export function pollLessons({
  load,
  onData,
  onError,
  visible = () => true,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  interval = 15000,
}) {
  let disposed = false,
    running = false,
    timer,
    controller,
    failures = 0;
  function schedule() {
    if (!disposed)
      timer = setTimer(refresh, Math.min(60000, interval * 2 ** failures));
  }
  async function refresh() {
    clearTimer(timer);
    if (disposed || running) return;
    if (!visible()) {
      schedule();
      return;
    }
    running = true;
    controller = new AbortController();
    try {
      const data = await load(controller.signal);
      if (!disposed) {
        failures = 0;
        onData(data);
      }
    } catch (error) {
      if (!disposed && !controller.signal.aborted) {
        failures = Math.min(2, failures + 1);
        onError(error);
      }
    } finally {
      running = false;
      schedule();
    }
  }
  refresh();
  return {
    refresh,
    stop() {
      disposed = true;
      clearTimer(timer);
      controller?.abort();
    },
  };
}
export function sameLessons(previous, next) {
  return (
    previous.length === next.length &&
    previous.every(
      (item, index) =>
        item.id === next[index].id &&
        item.title === next[index].title &&
        item.updated_at === next[index].updated_at,
    )
  );
}
