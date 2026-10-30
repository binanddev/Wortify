let opening;
function database() {
  if (opening) return opening;
  let rejected = false;
  const attempt = new Promise((resolve, reject) => {
    const request = indexedDB.open("wortify-teaching", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => {
      const db = request.result;
      if (rejected) {
        db.close();
        return;
      }
      const forget = () => {
        if (opening === attempt) opening = undefined;
      };
      db.onversionchange = () => {
        db.close();
        forget();
      };
      db.onclose = forget;
      resolve(db);
    };
    request.onerror = () => {
      rejected = true;
      reject(request.error);
    };
    request.onblocked = () => {
      rejected = true;
      reject(
        new Error("The lesson draft database is blocked by another window."),
      );
    };
  });
  opening = attempt;
  attempt.catch(() => {
    if (opening === attempt) opening = undefined;
  });
  return opening;
}
export async function draftStore(key, value) {
  const db = await database();
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(
        "drafts",
        value === undefined ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("drafts");
      const request =
        value === undefined
          ? store.get(key)
          : value === null
            ? store.delete(key)
            : store.put(value, key);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    } catch (error) {
      if (error.name === "InvalidStateError") opening = undefined;
      reject(error);
    }
  });
}
