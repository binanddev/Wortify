// One persisted snapshot per authenticated login. Images are Blobs, never data URLs in localStorage.
const inFlight = new Map();
let database;
let generation = 0;
function db() {
  if (!database)
    database = new Promise((resolve, reject) => {
      const r = indexedDB.open("wortify-login-appearance", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("snapshots");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error("Image storage is blocked."));
    });
  return database;
}
async function transaction(mode, operation) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("snapshots", mode);
    const request = operation(tx.objectStore("snapshots"));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export const appearanceStore = {
  get: (key) => transaction("readonly", (store) => store.get(key)),
  put: (key, value) =>
    transaction("readwrite", (store) => store.put(value, key)),
};
export async function clearLoginAppearance() {
  generation += 1;
  inFlight.clear();
  try {
    await transaction("readwrite", (store) => store.clear());
  } catch {
    /* browser storage disabled */
  }
}
export async function loadLoginSnapshot(
  key,
  getManifest,
  fetchImage,
  store = appearanceStore,
) {
  if (inFlight.has(key)) return inFlight.get(key);
  const epoch = generation;
  const load = async () => {
    let snapshot;
    try {
      snapshot = await store.get(key);
    } catch {
      // Do not silently download 30 MB again on every reload when persistence is blocked.
      return {
        data: {},
        images: {},
        warning:
          "Browser storage is unavailable. Enable site storage and sign in again.",
      };
    }
    if (epoch !== generation) throw new Error("Appearance session ended");
    if (snapshot) return snapshot;
    snapshot = {
      data: {},
      images: {},
      warning: "Backgrounds have not finished loading. Sign in again to retry.",
    };
    await store.put(key, snapshot); // A reload midway through download must not start a second download.
    try {
      snapshot.data = await getManifest();
      const urls = [
        ...new Set(
          Object.values(snapshot.data)
            .map((item) => item.background_url)
            .filter(Boolean),
        ),
      ];
      for (const url of urls) {
        if (epoch !== generation) throw new Error("Appearance session ended");
        const response = await fetchImage(url);
        if (!response.ok) throw new Error("Unable to load the background.");
        const image = await response.blob();
        if (image.size > 30 * 1024 * 1024 || !image.type.startsWith("image/"))
          throw new Error("Invalid background.");
        snapshot.images[url] = image;
      }
      snapshot.warning = "";
    } catch {
      snapshot.warning =
        "Some backgrounds could not be loaded. Sign out and sign in to retry.";
    }
    if (epoch !== generation) throw new Error("Appearance session ended");
    try {
      await store.put(key, snapshot);
    } catch {
      snapshot.warning =
        "Not enough storage for backgrounds. Free up browser storage and sign in again.";
    }
    return snapshot;
  };
  const promise = globalThis.navigator?.locks
    ? navigator.locks.request(`appearance:${key}`, load)
    : load();
  inFlight.set(key, promise);
  return promise;
}
