const DB_NAME = "cliniq-offline-db";
const STORE = "syncQueue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function waitForTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function queueOfflineRequest(path: string, body: unknown) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).add({ path, body, createdAt: Date.now() });
  await waitForTx(tx);
}

export async function pullOfflineQueue(): Promise<Array<{ id: number; path: string; body: unknown }>> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).getAll();
  const data = await new Promise<Array<{ id: number; path: string; body: unknown }>>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as Array<{ id: number; path: string; body: unknown }>);
    req.onerror = () => reject(req.error);
  });
  return data;
}

export async function removeOfflineItem(id: number) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await waitForTx(tx);
}
