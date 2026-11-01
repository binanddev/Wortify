// Queue snapshots use a separate database so large appearance/media caches cannot
// consume the synchronous localStorage fallback used by learning interactions.
let database;
function openDatabase() {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("wortify-learning-queue", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("queues");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Learning storage is blocked."));
    });
  return database;
}
async function transact(mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queues", mode);
    const request = operation(tx.objectStore("queues"));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
const backupStore = {
  get: (key) => transact("readonly", (store) => store.get(key)),
  put: (key, value) => transact("readwrite", (store) => store.put(value, key)),
};
export function createLearningQueueStore({
  storage = () => localStorage,
  backup = backupStore,
  changed = () => {},
} = {}) {
  const states = new Map();
  function local(key) {
    try {
      return storage().getItem(key);
    } catch {
      return null;
    }
  }
  function decode(raw) {
    try {
      const value = JSON.parse(raw);
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
  function state(key) {
    if (!states.has(key))
      states.set(key, {
        original: local(key),
        value: decode(local(key)),
        edits: [],
        localDurable: local(key) !== null,
        backupDurable: false,
        chain: Promise.resolve(),
      });
    return states.get(key);
  }
  function saveLocal(key, entry) {
    try {
      storage().setItem(key, JSON.stringify(entry.value));
      entry.localDurable = true;
    } catch {
      entry.localDurable = false;
    }
  }
  function persist(key, entry) {
    const snapshot = {
      value: structuredClone(entry.value),
      localValue: local(key),
    };
    entry.backupDurable = false;
    entry.chain = entry.chain
      .catch(() => {})
      .then(() => backup.put(key, snapshot))
      .then(() => {
        entry.backupDurable =
          JSON.stringify(entry.value) === JSON.stringify(snapshot.value);
        changed();
      })
      .catch(() => {
        entry.backupDurable = false;
        changed();
      });
    return entry.chain;
  }
  function restore(key) {
    const entry = state(key);
    if (!entry.ready)
      entry.ready = (async () => {
        const original = entry.original;
        try {
          const saved = await backup.get(key);
          // A changed local snapshot means it was committed after the backup.
          const base =
            saved && (original === null || original === saved.localValue)
              ? saved.value
              : decode(original);
          entry.value = entry.edits.reduce(
            (value, edit) => edit(value),
            Array.isArray(base) ? base : [],
          );
        } catch {
          /* The synchronous queue remains usable when IndexedDB is blocked. */
        }
        entry.edits = null;
        saveLocal(key, entry);
        await persist(key, entry);
        changed();
      })();
    return entry.ready;
  }
  return {
    read(key) {
      const entry = state(key);
      if (!entry.edits && entry.localDurable) {
        const raw = local(key);
        if (raw !== null) entry.value = decode(raw);
      }
      return structuredClone(entry.value);
    },
    update(key, edit) {
      const entry = state(key);
      if (!entry.edits && entry.localDurable && local(key) !== null)
        entry.value = decode(local(key));
      if (entry.edits) entry.edits.push(edit);
      entry.value = edit(structuredClone(entry.value));
      saveLocal(key, entry);
      if (entry.edits) restore(key);
      else persist(key, entry);
      return structuredClone(entry.value);
    },
    restore,
    settled: async (key) => {
      await restore(key);
      await state(key).chain;
    },
    durable: (key) => {
      const entry = state(key);
      return entry.localDurable || entry.backupDurable;
    },
  };
}
export const learningQueueStore = createLearningQueueStore({
  changed: () => {
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("learning-sync-change"));
  },
});
