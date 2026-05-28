/**
 * IndexedDB 封装 — 照片本地持久化
 */
const DB_NAME = 'coupleGallery';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

/** 打开数据库 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/** 检查是否有已保存的照片 */
async function hasStoredPhotos() {
  const photos = await loadPhotos();
  return photos.length > 0;
}

/** 追加照片（保留已有，新图排在后面） */
async function appendPhotos(files) {
  const existing = await loadPhotos();
  const maxOrder = existing.length
    ? Math.max(...existing.map((p) => p.order))
    : -1;
  const now = Date.now();
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const promises = Array.from(files).map((file, index) => {
    const record = {
      id: `photo_${now}_${index}`,
      blob: file,
      name: file.name,
      order: maxOrder + 1 + index,
      createdAt: now,
    };
    return new Promise((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  });

  const added = await Promise.all(promises);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(added);
    tx.onerror = () => reject(tx.error);
  });
}

/** 保存照片列表（先清空再写入） */
async function savePhotos(files) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.clear();

  const now = Date.now();
  const promises = Array.from(files).map((file, index) => {
    const record = {
      id: `photo_${now}_${index}`,
      blob: file,
      name: file.name,
      order: index,
      createdAt: now,
    };
    return new Promise((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  await Promise.all(promises);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 读取全部照片，按 order 排序 */
async function loadPhotos() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const items = request.result || [];
      items.sort((a, b) => a.order - b.order);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}
