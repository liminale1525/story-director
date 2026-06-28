// 千幕 · 通用二进制存储层（IndexedDB）
// 服务 TTS 音频缓存 / 收藏夹；后续电子书文件可复用。
// 与 index.js 完全解耦：不反向依赖、不读 settings，纯键值存取。
// localStorage 存不下二进制大对象，故独立走 IndexedDB；存 Blob，播放时再 createObjectURL。

const DB_NAME = 'qianmu-blobstore';
const DB_VERSION = 1;
const STORE_AUDIO = 'audio';         // key: 缓存键   value: { blob, meta, createdAt }
const STORE_FAVORITES = 'favorites'; // key: 收藏 id  value: { blob, meta, label, createdAt }

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); }
    catch (e) { dbPromise = null; reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_AUDIO)) db.createObjectStore(STORE_AUDIO);
      if (!db.objectStoreNames.contains(STORE_FAVORITES)) db.createObjectStore(STORE_FAVORITES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

// 把单个 IDBRequest 包成 Promise
function reqP(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(name, mode) {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

// ── 音频缓存 ──────────────────────────────────────────────

export async function putAudio(key, blob, meta) {
  const s = await store(STORE_AUDIO, 'readwrite');
  await reqP(s.put({ blob, meta: meta || {}, createdAt: Date.now() }, key));
  return key;
}

export async function getAudio(key) {
  const s = await store(STORE_AUDIO, 'readonly');
  return reqP(s.get(key));
}

export async function hasAudio(key) {
  const s = await store(STORE_AUDIO, 'readonly');
  const k = await reqP(s.getKey ? s.getKey(key) : s.get(key));
  return k !== undefined && k !== null;
}

export async function deleteAudio(key) {
  const s = await store(STORE_AUDIO, 'readwrite');
  await reqP(s.delete(key));
}

export async function clearAudioCache() {
  const s = await store(STORE_AUDIO, 'readwrite');
  await reqP(s.clear());
}

// 缓存上限裁剪：按 createdAt 保留最新 maxEntries 条，其余删除（近似 LRU）
export async function pruneAudio(maxEntries) {
  if (!maxEntries || maxEntries < 1) return;
  const s = await store(STORE_AUDIO, 'readwrite');
  const entries = [];
  await new Promise((resolve, reject) => {
    const cur = s.openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) { resolve(); return; }
      entries.push({ key: c.key, createdAt: (c.value && c.value.createdAt) || 0 });
      c.continue();
    };
    cur.onerror = () => reject(cur.error);
  });
  if (entries.length <= maxEntries) return;
  entries.sort((a, b) => b.createdAt - a.createdAt); // 新→旧
  const doomed = entries.slice(maxEntries);
  for (const e of doomed) await reqP(s.delete(e.key));
}

// 列出全部音频缓存（含 blob）：用于导出。返回 [{ key, blob, meta, createdAt }]
export async function listAudio() {
  const s = await store(STORE_AUDIO, 'readonly');
  const out = [];
  await new Promise((resolve, reject) => {
    const cur = s.openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) { resolve(); return; }
      const v = c.value || {};
      out.push({ key: c.key, blob: v.blob, meta: v.meta || {}, createdAt: v.createdAt || 0 });
      c.continue();
    };
    cur.onerror = () => reject(cur.error);
  });
  return out;
}

// 批量写入音频缓存（用于导入）：entries=[{ key, blob, meta, createdAt }]，已存在的 key 跳过（不覆盖本地新生成的）。
// 返回 { added, skipped }
export async function bulkPutAudio(entries) {
  let added = 0, skipped = 0;
  if (!Array.isArray(entries) || !entries.length) return { added, skipped };
  const s = await store(STORE_AUDIO, 'readwrite');
  for (const e of entries) {
    if (!e || !e.key || !e.blob) { skipped++; continue; }
    const existing = await reqP(s.getKey ? s.getKey(e.key) : s.get(e.key));
    if (existing !== undefined && existing !== null) { skipped++; continue; }
    await reqP(s.put({ blob: e.blob, meta: e.meta || {}, createdAt: e.createdAt || Date.now() }, e.key));
    added++;
  }
  return { added, skipped };
}

// ── 收藏夹 ────────────────────────────────────────────────

export async function addFavorite(favId, blob, meta, label) {
  const s = await store(STORE_FAVORITES, 'readwrite');
  await reqP(s.put({ blob, meta: meta || {}, label: label || '', createdAt: Date.now() }, favId));
  return favId;
}

export async function getFavorite(favId) {
  const s = await store(STORE_FAVORITES, 'readonly');
  return reqP(s.get(favId));
}

export async function removeFavorite(favId) {
  const s = await store(STORE_FAVORITES, 'readwrite');
  await reqP(s.delete(favId));
}

// 列出收藏（含 blob，便于直接播放）。返回 [{ id, blob, meta, label, createdAt }]
export async function listFavorites() {
  const s = await store(STORE_FAVORITES, 'readonly');
  const out = [];
  await new Promise((resolve, reject) => {
    const cur = s.openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) { resolve(); return; }
      const v = c.value || {};
      out.push({ id: c.key, blob: v.blob, meta: v.meta || {}, label: v.label || '', createdAt: v.createdAt || 0 });
      c.continue();
    };
    cur.onerror = () => reject(cur.error);
  });
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

// 探活：环境是否支持 IndexedDB（个别隐私模式/旧内核可能没有）
export function blobStoreAvailable() {
  try { return typeof indexedDB !== 'undefined' && !!indexedDB; }
  catch (_) { return false; }
}
