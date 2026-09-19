// Stockage local : IndexedDB brut (pas de dépendance). Rien ne sort du téléphone.

const DB_NAME = 'poker-master';
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('ranges')) {
        db.createObjectStore('ranges', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('attempts')) {
        const s = db.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true });
        s.createIndex('by_ts', 'ts');
        s.createIndex('by_spot', 'spot');
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'k' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, run) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = run(t.objectStore(store));
    t.oncomplete = () => resolve(result ? result.value : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function wrap(request) {
  const box = { value: undefined };
  request.onsuccess = () => { box.value = request.result; };
  return box;
}

export const db = {
  get: (store, key) => tx(store, 'readonly', (s) => wrap(s.get(key))),
  all: (store) => tx(store, 'readonly', (s) => wrap(s.getAll())),
  put: (store, value) => tx(store, 'readwrite', (s) => wrap(s.put(value))),
  putMany: (store, values) => tx(store, 'readwrite', (s) => { values.forEach((v) => s.put(v)); }),
  del: (store, key) => tx(store, 'readwrite', (s) => { s.delete(key); }),
  clear: (store) => tx(store, 'readwrite', (s) => { s.clear(); }),
  count: (store) => tx(store, 'readonly', (s) => wrap(s.count())),
};

/** Réglage persistant (thème, dernière config de drill...). */
export async function getSetting(key, fallback) {
  const row = await db.get('meta', key);
  return row === undefined ? fallback : row.v;
}

export function setSetting(key, v) {
  return db.put('meta', { k: key, v });
}
