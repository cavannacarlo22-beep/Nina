/**
 * Il motore di sincronizzazione, lato web.
 *
 * Stesso giro dell'app iOS di Nina:
 *   1. push — manda le modifiche locali (`_dirty` = 1) e le cancellazioni;
 *   2. pull — chiede al server tutto ciò che è cambiato dopo il cursore;
 *   3. salva il nuovo cursore.
 *
 * Le schermate leggono e scrivono solo il database locale: la rete non le
 * blocca mai. Il server decide i conflitti (vince la modifica più recente sul
 * dispositivo, le cancellazioni vincono sempre) e ogni rifiuto riporta lo
 * stato autorevole, che qui viene adottato.
 */
import {
  db, DEFAULT_CATEGORIES, DOCUMENT_TABLES, flushTombstones, markRemote, NATIVE_TABLES, setLocalChangeListener, stamp,
  type DocumentTable, type NativeTable, type SyncedTable,
} from '../db/db';
import { api, apiJson, ApiError, currentSession } from './api';

type Row = Record<string, unknown> & { id: string; _dirty?: 0 | 1; _cu?: string };

type Entity = NativeTable | 'documents';

interface Change { entity: Entity; id: string; clientUpdatedAt: string; data: Record<string, unknown> }
interface PushResult { entity: Entity; id: string; outcome: 'applied' | 'rejected' | 'ignored'; server: Record<string, unknown> | null; reason?: string }
interface PullPage { changes: { entity: string; data: Record<string, unknown> }[]; cursor: number; hasMore: boolean }

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error';
export interface SyncState {
  status: SyncStatus;
  lastSyncAt: number;
  pending: number;
  conflicts: number;
  message: string;
  live: boolean;
}

/* ——— stato osservabile ——— */

let state: SyncState = { status: 'off', lastSyncAt: 0, pending: 0, conflicts: 0, message: '', live: false };
const listeners = new Set<(s: SyncState) => void>();
function setState(p: Partial<SyncState>) {
  state = { ...state, ...p };
  listeners.forEach((l) => l(state));
}
export function getSyncState(): SyncState {
  return state;
}
export function subscribeSync(fn: (s: SyncState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ——— conversioni ——— */

const NATIVE = new Set<string>(NATIVE_TABLES);
const DOCS = new Set<string>(DOCUMENT_TABLES);
const LOCAL_FIELDS = new Set(['_dirty', '_cu']);
/** Campi che il server gestisce da sé e che non vanno rimandati. */
const SERVER_META = new Set(['version', 'syncSeq', 'updatedAt', 'clientUpdatedAt', 'deletedAt']);

function strip(row: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!LOCAL_FIELDS.has(k) && v !== undefined) out[k] = v;
  return out;
}

export function toChange(table: SyncedTable, row: Row): Change {
  const clientUpdatedAt = row._cu ?? stamp();
  if (NATIVE.has(table)) {
    const data = strip(row);
    delete data.id;
    return { entity: table as NativeTable, id: row.id, clientUpdatedAt, data };
  }
  const data = strip(row);
  delete data.id;
  return { entity: 'documents', id: row.id, clientUpdatedAt, data: { collection: table, data } };
}

/** Converte una riga arrivata dal server nella riga locale (o null se va cancellata / ignorata). */
export function fromServer(entity: string, data: Record<string, unknown>): { table: SyncedTable; row: Row | null; id: string; cu: string } | null {
  const id = String(data.id);
  const cu = String(data.clientUpdatedAt ?? '');
  const deleted = data.deletedAt !== null && data.deletedAt !== undefined;
  if (entity === 'documents') {
    const collection = String(data.collection ?? '');
    if (!DOCS.has(collection)) return null;
    if (deleted) return { table: collection as DocumentTable, row: null, id, cu };
    const body = (data.data ?? {}) as Record<string, unknown>;
    return { table: collection as DocumentTable, row: { ...body, id, _dirty: 0, _cu: cu }, id, cu };
  }
  if (!NATIVE.has(entity)) return null;
  if (deleted) return { table: entity as NativeTable, row: null, id, cu };
  const row: Row = { id, _dirty: 0, _cu: cu };
  for (const [k, v] of Object.entries(data)) if (!SERVER_META.has(k)) row[k] = v;
  return { table: entity as NativeTable, row, id, cu };
}

/* ——— applicazione delle modifiche remote ——— */

async function applyRemote(items: { entity: string; data: Record<string, unknown> }[]): Promise<void> {
  const parsed = items.map((i) => fromServer(i.entity, i.data)).filter((x): x is NonNullable<typeof x> => x !== null);
  if (!parsed.length) return;
  const tables = [...new Set(parsed.map((p) => p.table))];
  const scope = [...tables.map((t) => db.table(t)), db.tombstones, ...(tables.includes('files') ? [db.fileBlobs] : [])];
  await db.transaction('rw', scope, async (tx) => {
    markRemote(tx);
    for (const p of parsed) {
      const table = db.table(p.table);
      const local = (await table.get(p.id)) as Row | undefined;
      const tomb = await db.tombstones.get(`${p.table}:${p.id}`);
      // una modifica locale più recente non ancora inviata vince: partirà al prossimo push
      if (local?._dirty && (local._cu ?? '') > p.cu) continue;
      if (tomb && tomb.at > p.cu && p.row) continue;
      if (p.row === null) {
        await table.delete(p.id);
        if (p.table === 'files') await db.fileBlobs.delete(p.id);
        if (tomb) await db.tombstones.delete(tomb.key);
      } else {
        await table.put(p.row);
      }
    }
  });
}

/* ——— push ——— */

const MAX_BATCH = 100;
const MAX_BATCH_BYTES = 6 * 1024 * 1024;

async function collectDirty(): Promise<{ table: SyncedTable; row: Row }[]> {
  const out: { table: SyncedTable; row: Row }[] = [];
  // l'ordine conta: un completamento ha bisogno della sua abitudine, una nota veloce della sua attività
  for (const table of [...NATIVE_TABLES, ...DOCUMENT_TABLES]) {
    const rows = (await db.table(table).where('_dirty').equals(1).toArray()) as Row[];
    for (const row of rows) out.push({ table, row });
  }
  return out;
}

async function countPending(): Promise<number> {
  let n = await db.tombstones.count();
  for (const t of [...NATIVE_TABLES, ...DOCUMENT_TABLES]) n += await db.table(t).where('_dirty').equals(1).count();
  return n;
}

async function push(): Promise<void> {
  await flushTombstones();
  const dirty = await collectDirty();
  const tombs = await db.tombstones.toArray();
  type Pending = { change: Change; table: SyncedTable; sentCu: string; tomb?: string };
  const pending: Pending[] = [
    ...dirty.map(({ table, row }) => ({ change: toChange(table, row), table, sentCu: row._cu ?? '' })),
    ...tombs
      .filter((t) => NATIVE.has(t.table) || DOCS.has(t.table))
      .map((t) => ({
        change: { entity: (NATIVE.has(t.table) ? t.table : 'documents') as Entity, id: t.id, clientUpdatedAt: t.at, data: { deletedAt: t.at } },
        table: t.table as SyncedTable,
        sentCu: t.at,
        tomb: t.key,
      })),
  ];
  if (!pending.length) return;

  // lotti limitati per numero e per peso (i capitoli con le foto pesano)
  const batches: Pending[][] = [];
  let cur: Pending[] = [];
  let bytes = 0;
  for (const p of pending) {
    const size = JSON.stringify(p.change).length;
    if (cur.length && (cur.length >= MAX_BATCH || bytes + size > MAX_BATCH_BYTES)) {
      batches.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(p);
    bytes += size;
  }
  if (cur.length) batches.push(cur);

  for (const batch of batches) {
    const res = await apiJson<{ results: PushResult[] }>('/sync/push', { method: 'POST', json: { changes: batch.map((b) => b.change) } });
    const authoritative: { entity: string; data: Record<string, unknown> }[] = [];
    let conflicts = 0;
    await db.transaction('rw', [...new Set(batch.map((b) => db.table(b.table))), db.tombstones], async (tx) => {
      markRemote(tx);
      for (let i = 0; i < batch.length; i++) {
        const b = batch[i];
        const r = res.results[i];
        if (!r) continue;
        if (b.tomb) {
          await db.tombstones.delete(b.tomb);
          continue;
        }
        const table = db.table(b.table);
        const local = (await table.get(b.change.id)) as Row | undefined;
        if (r.outcome === 'rejected') {
          conflicts++;
          if (r.server) authoritative.push({ entity: r.entity, data: r.server });
          // se il server non può accettarla (dati non validi) non la si ritenta all'infinito
          if (!r.server && local && local._cu === b.sentCu) await table.update(b.change.id, { _dirty: 0 });
          if (r.server && local && local._cu === b.sentCu) await table.update(b.change.id, { _dirty: 0, _cu: '' });
          if (!r.server) console.warn('Modifica rifiutata dal server', b.table, b.change.id, r.reason);
          continue;
        }
        // applied / ignored: è arrivata. Se nel frattempo la riga è cambiata di nuovo resta da inviare.
        if (local && local._cu === b.sentCu) await table.update(b.change.id, { _dirty: 0 });
      }
    });
    if (authoritative.length) await applyRemote(authoritative);
    if (conflicts) setState({ conflicts: state.conflicts + conflicts });
    // i file eliminati: si libera anche lo spazio sul server
    for (const b of batch) {
      if (b.tomb && b.table === 'files') void api(`/files/${b.change.id}`, { method: 'DELETE' }).catch(() => {});
    }
  }
}

/* ——— pull ——— */

async function pull(): Promise<void> {
  let cursor = Number((await db.localSettings.get('syncCursor'))?.value ?? 0);
  for (let guard = 0; guard < 1000; guard++) {
    const page = await apiJson<PullPage>(`/sync/changes?since=${cursor}&limit=300`);
    await applyRemote(page.changes);
    cursor = page.cursor;
    await db.localSettings.put({ key: 'syncCursor', value: cursor });
    if (!page.hasMore) break;
  }
}

/* ——— file ——— */

async function uploadBlobs(): Promise<void> {
  const blobs = await db.fileBlobs.where('uploaded').equals(0).toArray();
  for (const b of blobs) {
    const meta = await db.files.get(b.id);
    if (!meta) {
      await db.fileBlobs.delete(b.id);
      continue;
    }
    try {
      await api(`/files/${b.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream', 'X-Nina-File-Mime': meta.mime || 'application/octet-stream' },
        body: b.blob,
      });
      await db.fileBlobs.update(b.id, { uploaded: 1 });
    } catch (e) {
      if (e instanceof ApiError && e.status === 413) {
        console.warn('File troppo grande per il server, resta solo su questo dispositivo', meta.name);
        await db.fileBlobs.update(b.id, { uploaded: 1 });
      } else throw e;
    }
  }
}

/** Il contenuto di un file: dal dispositivo se c'è, altrimenti dal server. */
export async function getFileBlob(id: string): Promise<Blob | null> {
  const local = await db.fileBlobs.get(id);
  if (local) return local.blob;
  if (!(await currentSession())) return null;
  try {
    const res = await api(`/files/${id}`);
    const blob = await res.blob();
    await db.fileBlobs.put({ id, blob, uploaded: 1 });
    return blob;
  } catch {
    return null;
  }
}

/* ——— primo collegamento ——— */

/**
 * Al primo accesso su un dispositivo che ha già usato Nina senza account:
 * le categorie predefinite create qui non devono duplicare quelle dell'account.
 */
async function dropUntouchedDefaults(): Promise<void> {
  const serverHas = (await db.localSettings.get('syncCursor'))?.value;
  if (!serverHas) return;
  const cats = await db.categories.toArray();
  const names = DEFAULT_CATEGORIES.map((c) => c.name);
  const remoteCats = cats.filter((c) => !c._dirty);
  const localDefaults = cats.filter((c) => c._dirty && names.includes(c.name));
  if (!remoteCats.length || !localDefaults.length) return;
  const used = new Set((await db.events.toArray()).map((e) => e.categoryId));
  await db.transaction('rw', db.categories, db.events, async (tx) => {
    markRemote(tx);
    for (const c of localDefaults) {
      const twin = remoteCats.find((r) => r.name === c.name);
      if (!twin && used.has(c.id)) continue;
      if (twin) await db.events.where('categoryId').equals(c.id).modify({ categoryId: twin.id, _dirty: 1, _cu: stamp() });
      await db.categories.delete(c.id);
    }
  });
}

/* ——— il giro completo ——— */

let running: Promise<void> | null = null;
let again = false;

export async function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      if (!(await currentSession())) {
        setState({ status: 'off', pending: await countPending() });
        return;
      }
      if (!navigator.onLine) {
        setState({ status: 'offline', pending: await countPending() });
        return;
      }
      setState({ status: 'syncing', message: '' });
      try {
        const firstTime = !(await db.localSettings.get('syncCursor'));
        if (firstTime) {
          // primo collegamento: prima si scarica l'account, poi si unisce quello che c'è qui
          await pull();
          await dropUntouchedDefaults();
        }
        await uploadBlobs();
        await push();
        await pull();
        setState({ status: 'idle', lastSyncAt: Date.now(), pending: await countPending(), message: '' });
        await db.localSettings.put({ key: 'lastSyncAt', value: Date.now() });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const offline = e instanceof ApiError && e.status === 0;
        setState({ status: offline ? 'offline' : 'error', message: msg, pending: await countPending() });
        if (e instanceof ApiError && e.status === 401) return;
      }
    } while (again);
  })().finally(() => { running = null; });
  return running;
}

/* ——— pianificazione: modifiche locali, rete, tempo reale ——— */

let debounce: number | null = null;
export function scheduleSync(delay = 1200): void {
  if (debounce) clearTimeout(debounce);
  debounce = window.setTimeout(() => { debounce = null; void syncNow(); }, delay);
}

let streamAbort: AbortController | null = null;
let streamRetry = 0;

async function openStream(): Promise<void> {
  streamAbort?.abort();
  if (!(await currentSession()) || !navigator.onLine || document.visibilityState === 'hidden') return;
  const ctrl = new AbortController();
  streamAbort = ctrl;
  try {
    const res = await api('/sync/stream', { signal: ctrl.signal, headers: { Accept: 'text/event-stream' } });
    if (!res.body) return;
    setState({ live: true });
    streamRetry = 0;
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (/^event:\s*changed/m.test(chunk)) scheduleSync(300);
      }
    }
  } catch {
    /* chiusa o rete assente: si riprova */
  } finally {
    if (streamAbort === ctrl) {
      setState({ live: false });
      if (!ctrl.signal.aborted) {
        streamRetry = Math.min(streamRetry + 1, 6);
        setTimeout(() => void openStream(), 2000 * 2 ** streamRetry);
      }
    }
  }
}

function closeStream() {
  streamAbort?.abort();
  streamAbort = null;
  setState({ live: false });
}

let started = false;
export function startSync(): () => void {
  if (started) return () => {};
  started = true;
  setLocalChangeListener(() => {
    void countPending().then((pending) => setState({ pending }));
    scheduleSync();
  });
  const onOnline = () => { void syncNow(); void openStream(); };
  const onOffline = () => { setState({ status: 'offline' }); closeStream(); };
  const onVisible = () => {
    if (document.visibilityState === 'visible') { void syncNow(); void openStream(); } else closeStream();
  };
  const onSession = () => { void syncNow(); void openStream(); };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('nina-session', onSession);
  const timer = setInterval(() => void syncNow(), 5 * 60 * 1000);
  void syncNow();
  void openStream();
  return () => {
    started = false;
    setLocalChangeListener(null);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('nina-session', onSession);
    clearInterval(timer);
    closeStream();
  };
}

/** Esci: si cancella tutto da questo dispositivo (resta il server). */
export async function wipeLocalData(): Promise<void> {
  closeStream();
  const keep = await Promise.all(['deviceId', 'serverUrl'].map((k) => db.localSettings.get(k)));
  await db.transaction('rw', db.tables, async (tx) => {
    markRemote(tx);
    for (const t of db.tables) await t.clear();
    for (const k of keep) if (k) await db.localSettings.put(k);
  });
  setState({ status: 'off', pending: 0, conflicts: 0, lastSyncAt: 0 });
}

/** Adotta righe arrivate dal server fuori dal giro normale (es. la risposta dell'amica). */
export const adoptFromServer = applyRemote;

/** Per i test. */
export const __test = { push, pull, applyRemote, collectDirty };
