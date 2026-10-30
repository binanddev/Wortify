// A lesson may contain many 300 MB documents. Keep only the current document
// loading task, so navigation cancels old downloads as well as releasing workers.
export function createPdfDocumentCache(load, capacity = 1) {
  const entries = new Map();
  const aborted = () =>
    new DOMException("PDF request superseded", "AbortError");
  function dispose(entry) {
    if (entry.disposed) return Promise.resolve();
    entry.disposed = true;
    return entry.task
      ? Promise.resolve(entry.task.destroy()).catch(() => {})
      : Promise.resolve();
  }
  function get(key) {
    const known = entries.get(key);
    if (known) {
      entries.delete(key);
      entries.set(key, known);
      return known.promise;
    }
    const entry = { task: null, disposed: false, promise: null };
    entry.promise = Promise.resolve()
      .then(() => {
        if (entry.disposed) throw aborted();
        return load(key);
      })
      .then(async (task) => {
        entry.task = task;
        if (entry.disposed) {
          await task.destroy();
          throw aborted();
        }
        const document = await task.promise;
        if (entry.disposed) throw aborted();
        return document;
      })
      .catch((error) => {
        dispose(entry);
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
    entries.set(key, entry);
    while (entries.size > capacity) {
      const oldest = entries.keys().next().value;
      dispose(entries.get(oldest));
      entries.delete(oldest);
    }
    return entry.promise;
  }
  return {
    get,
    clear() {
      const pending = [...entries.values()].map(dispose);
      entries.clear();
      return Promise.all(pending);
    },
  };
}
