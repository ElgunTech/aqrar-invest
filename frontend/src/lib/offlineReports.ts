import { useSyncExternalStore } from "react";

/**
 * Offline queue for milestone photo reports. In the field there is often no signal: the report (text, amount, photo,
 * GPS) is kept in IndexedDB on the device and sent as soon as a connection appears. Each item shows its state:
 * pending → sending → sent, or error when the server rejects it (a network failure keeps it pending).
 */
export type QueueStatus = "pending" | "sending" | "sent" | "error";
export interface QueuedReport {
  id: string;
  applicationId: number;
  milestoneId: number;
  milestoneTitle: string;
  text: string;
  investment: string;
  photo: Blob;
  photoName: string;
  lat?: number;
  lng?: number;
  gpsSource?: "exif" | "device";
  createdAt: number;
  status: QueueStatus;
  error?: string;
  sentAt?: number;
}

const DB = "aqrar-offline";
const STORE = "reports";
let items: QueuedReport[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function reload() {
  try {
    items = ((await tx("readonly", (s) => s.getAll())) as QueuedReport[]).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    items = [];
  }
  emit();
}

async function put(r: QueuedReport) {
  await tx("readwrite", (s) => s.put(r));
  await reload();
}

export async function enqueue(r: Omit<QueuedReport, "id" | "createdAt" | "status">) {
  await put({ ...r, id: crypto.randomUUID(), createdAt: Date.now(), status: "pending" });
  void flush();
}

export async function remove(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  await reload();
}

export async function retry(id: string) {
  const r = items.find((x) => x.id === id);
  if (r) await put({ ...r, status: "pending", error: undefined });
  void flush();
}

let flushing = false;
const sentHandlers = new Set<(applicationId: number) => void>();
/** Pages showing a project register here to reload it after a queued report went through. */
export function onSent(fn: (applicationId: number) => void) {
  sentHandlers.add(fn);
  return () => { sentHandlers.delete(fn); };
}

/** Sends every pending report, oldest first. Stops at the first network failure (still offline). */
export async function flush() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    await reload();
    for (const r of items.filter((x) => x.status === "pending")) {
      await put({ ...r, status: "sending" });
      const fd = new FormData();
      fd.append("text", r.text);
      fd.append("investment", r.investment);
      fd.append("photo", new File([r.photo], r.photoName, { type: r.photo.type || "image/jpeg" }));
      if (r.lat != null && r.lng != null) {
        fd.append("lat", String(r.lat));
        fd.append("lng", String(r.lng));
      }
      try {
        const res = await fetch(`/api/v1/me/applications/${r.applicationId}/milestones/${r.milestoneId}/report`, {
          method: "POST", body: fd, credentials: "same-origin",
        });
        if (res.ok) {
          await put({ ...r, status: "sent", sentAt: Date.now() });
          sentHandlers.forEach((f) => f(r.applicationId));
        } else if (res.status >= 500 || res.status === 429) {
          await put({ ...r, status: "pending" });
          break;
        } else {
          let msg = `Xəta (${res.status})`;
          try { msg = (await res.json()).message ?? msg; } catch { /* not JSON */ }
          await put({ ...r, status: "error", error: res.status === 401 ? "Sessiya bitib: yenidən daxil olun və «Yenidən göndər» basın" : msg });
        }
      } catch {
        await put({ ...r, status: "pending" }); // network gone again
        break;
      }
    }
    // sent items are kept for a day so the investor sees the confirmation, then cleaned up
    for (const r of items.filter((x) => x.status === "sent" && x.sentAt && Date.now() - x.sentAt > 86_400_000)) await remove(r.id);
  } finally {
    flushing = false;
  }
}

let started = false;
/** Called once at app start: load the queue, send on reconnect and every 30 s while something waits. */
export function startOfflineSync() {
  if (started || typeof indexedDB === "undefined") return;
  started = true;
  void reload().then(flush);
  addEventListener("online", () => void flush());
  addEventListener("offline", emit);
  setInterval(() => { if (items.some((x) => x.status === "pending")) void flush(); }, 30_000);
}

export function useOfflineQueue() {
  const list = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => items);
  const online = useSyncExternalStore((cb) => {
    addEventListener("online", cb); addEventListener("offline", cb);
    return () => { removeEventListener("online", cb); removeEventListener("offline", cb); };
  }, () => navigator.onLine);
  return { items: list, online };
}
