import JSZip from 'jszip';
import { db, DATA_TABLES, markRemote, SYNCED_TABLES, type DataTable } from '../db/db';
import type { FileBlob } from '../db/types';
import { decryptBytes, encryptBytes, isEncrypted } from './crypto';
import { convertPetaloData } from './petaloImport';

export const BACKUP_VERSION = 2;

/** Non vanno nei backup: la sessione e il cursore appartengono a questo dispositivo. */
const LOCAL_SECRET_KEYS = new Set(['session', 'syncCursor', 'deviceId', 'lastSyncAt', 'serverUrl']);

interface Manifest {
  app: 'nina';
  version: number;
  createdAt: number;
  counts: Record<string, number>;
}

/** Everything except file blobs, as plain JSON-serialisable data. */
export async function dumpData(): Promise<Record<DataTable, unknown[]>> {
  const out = {} as Record<DataTable, unknown[]>;
  await db.transaction('r', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) {
      const rows = await db.table(t).toArray();
      out[t] = t === 'fileBlobs' ? (rows as FileBlob[]).map(({ blob: _b, ...rest }) => rest) : t === 'localSettings' ? (rows as { key: string }[]).filter((r) => !LOCAL_SECRET_KEYS.has(r.key)) : rows;
    }
  });
  return out;
}

export async function createBackupZip(): Promise<Blob> {
  const data = await dumpData();
  const zip = new JSZip();
  const manifest: Manifest = {
    app: 'nina',
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('data.json', JSON.stringify(data));
  const files = zip.folder('files')!;
  for (const f of await db.fileBlobs.toArray()) {
    files.file(f.id, new Uint8Array(await f.blob.arrayBuffer()), { binary: true });
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function createBackup(password?: string): Promise<{ blob: Blob; name: string }> {
  const zipBlob = await createBackupZip();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  if (!password) return { blob: zipBlob, name: `nina-backup-${stamp}.zip` };
  const bytes = new Uint8Array(await zipBlob.arrayBuffer());
  const encrypted = await encryptBytes(bytes, password);
  return { blob: new Blob([encrypted], { type: 'application/octet-stream' }), name: `nina-backup-${stamp}.nina` };
}

export async function backupNeedsPassword(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return isEncrypted(head);
}

/** Replaces all data with the content of a backup. */
export async function restoreBackup(file: Blob, password?: string): Promise<Manifest> {
  let bytes = new Uint8Array(await file.arrayBuffer());
  if (isEncrypted(bytes)) {
    if (!password) throw new Error('Questo backup è protetto da password');
    bytes = new Uint8Array(await decryptBytes(bytes, password));
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error('Il file non è un backup valido di Nina');
  }
  const manifestFile = zip.file('manifest.json');
  const dataFile = zip.file('data.json');
  if (!manifestFile || !dataFile) throw new Error('Il file non è un backup valido di Nina');
  const manifest = JSON.parse(await manifestFile.async('string')) as Manifest;
  if (manifest.app !== 'nina' && manifest.app !== ('petalo' as string)) throw new Error('Il file non è un backup valido di Nina');
  let data = JSON.parse(await dataFile.async('string')) as Record<string, unknown[]>;
  // un backup di Petalo: si converte nel formato di Nina
  if ((manifest.app as string) === 'petalo') data = convertPetaloData(data);

  const blobRows: FileBlob[] = [];
  for (const meta of (data.fileBlobs ?? []) as Omit<FileBlob, 'blob'>[]) {
    const entry = zip.file('files/' + meta.id);
    if (!entry) continue;
    const fileMeta = (data.files ?? []).find((f) => (f as { id: string }).id === meta.id) as { mime?: string } | undefined;
    blobRows.push({ ...meta, uploaded: 0, blob: new Blob([await entry.async('uint8array')], { type: fileMeta?.mime ?? '' }) });
  }

  // Il contenuto ripristinato va ricaricato sul server come se fosse nuovo:
  // tutte le righe tornano "da inviare".
  await db.transaction('rw', DATA_TABLES.map((t) => db.table(t)), async (tx) => {
    markRemote(tx);
    for (const t of DATA_TABLES) {
      if (t === 'localSettings') continue;
      await db.table(t).clear();
      let rows = t === 'fileBlobs' ? blobRows : ((data[t] ?? []) as Record<string, unknown>[]);
      if ((SYNCED_TABLES as readonly string[]).includes(t)) rows = (rows as Record<string, unknown>[]).map((r) => ({ ...r, _dirty: 1, _cu: new Date().toISOString() }));
      if (rows.length) await db.table(t).bulkPut(rows);
    }
    for (const r of (data.localSettings ?? []) as { key: string; value: unknown }[]) {
      if (!LOCAL_SECRET_KEYS.has(r.key)) await db.localSettings.put(r);
    }
  });
  return manifest;
}

/* ——— automatic snapshots (kept inside the browser database) ——— */

const MAX_SNAPSHOTS = 10;

export async function takeSnapshot(): Promise<void> {
  const all = await dumpData();
  const data = JSON.stringify(Object.fromEntries(SYNCED_TABLES.map((t) => [t, all[t]])));
  await db.snapshots.add({ createdAt: Date.now(), size: data.length, data });
  const keys = await db.snapshots.orderBy('createdAt').primaryKeys();
  if (keys.length > MAX_SNAPSHOTS) await db.snapshots.bulkDelete(keys.slice(0, keys.length - MAX_SNAPSHOTS));
}

/** Ripristina una copia automatica. I file restano quelli attuali: le copie contengono solo i dati. */
export async function restoreSnapshot(id: number): Promise<void> {
  const snap = await db.snapshots.get(id);
  if (!snap) throw new Error('Copia non trovata');
  const data = JSON.parse(snap.data) as Record<string, unknown[]>;
  await db.transaction('rw', SYNCED_TABLES.map((t) => db.table(t)), async () => {
    // scritture normali (non remote): le differenze ripartono verso il server
    for (const t of SYNCED_TABLES) {
      const rows = (data[t] ?? []) as { id: string }[];
      const keep = new Set(rows.map((r) => r.id));
      const current = (await db.table(t).toCollection().primaryKeys()) as string[];
      await db.table(t).bulkDelete(current.filter((k) => !keep.has(k)));
      if (rows.length) await db.table(t).bulkPut(rows.map(({ ...r }) => { delete (r as Record<string, unknown>)._dirty; return r; }));
    }
  });
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e) return null;
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    return null;
  }
}
