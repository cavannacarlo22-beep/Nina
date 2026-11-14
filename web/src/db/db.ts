import Dexie, { type Table, type Transaction } from 'dexie';
import type {
  BeautyProduct, CalcEntry, CalEvent, Category, DayLog, DiaryEntry, FileBlob, FileRec, FocusSession, Folder,
  FriendMessage, Habit, HabitCompletion, LocalSetting, Look, Mood, Note, Notebook, QuickNote, RoutineStep,
  SettingRow, Sheet, Snapshot, Task, Tombstone, TodoList, WishItem,
} from './types';

export class NinaDB extends Dexie {
  // entità native del server
  tasks!: Table<Task, string>;
  habits!: Table<Habit, string>;
  habitCompletions!: Table<HabitCompletion, string>;
  moods!: Table<Mood, string>;
  diaryEntries!: Table<DiaryEntry, string>;
  wishlist!: Table<WishItem, string>;
  quickNotes!: Table<QuickNote, string>;
  friendMessages!: Table<FriendMessage, string>;
  // documenti
  categories!: Table<Category, string>;
  events!: Table<CalEvent, string>;
  lists!: Table<TodoList, string>;
  sheets!: Table<Sheet, string>;
  calcHistory!: Table<CalcEntry, string>;
  folders!: Table<Folder, string>;
  files!: Table<FileRec, string>;
  notebooks!: Table<Notebook, string>;
  notes!: Table<Note, string>;
  focus!: Table<FocusSession, string>;
  dayLogs!: Table<DayLog, string>;
  beauty!: Table<BeautyProduct, string>;
  looks!: Table<Look, string>;
  routine!: Table<RoutineStep, string>;
  settings!: Table<SettingRow, string>;
  // solo locali
  fileBlobs!: Table<FileBlob, string>;
  localSettings!: Table<LocalSetting, string>;
  tombstones!: Table<Tombstone, string>;
  snapshots!: Table<Snapshot, number>;

  constructor(name = 'nina') {
    super(name);
    this.version(1).stores({
      tasks: 'id, date, listId, isCompleted, _dirty',
      habits: 'id, sortOrder, _dirty',
      habitCompletions: 'id, habitId, date, _dirty',
      moods: 'id, date, _dirty',
      diaryEntries: 'id, entryDate, _dirty',
      wishlist: 'id, createdAt, _dirty',
      quickNotes: 'id, createdAt, _dirty',
      friendMessages: 'id, createdAt, _dirty',
      categories: 'id, order, _dirty',
      events: 'id, date, categoryId, _dirty',
      lists: 'id, order, kind, _dirty',
      sheets: 'id, updatedAt, _dirty',
      calcHistory: 'id, createdAt, _dirty',
      folders: 'id, parentId, _dirty',
      files: 'id, folderId, category, name, createdAt, favorite, _dirty',
      notebooks: 'id, order, _dirty',
      notes: 'id, notebookId, parentId, order, openedAt, updatedAt, _dirty',
      focus: 'id, date, notebookId, _dirty',
      dayLogs: 'id, date, _dirty',
      beauty: 'id, category, _dirty',
      looks: 'id, createdAt, _dirty',
      routine: 'id, when, order, _dirty',
      settings: 'id, key, _dirty',
      fileBlobs: 'id, uploaded',
      localSettings: 'key',
      tombstones: 'key, table',
      snapshots: '++id, createdAt',
    });
  }
}

export const db = new NinaDB();

/** Entità che il server conosce con il loro nome. */
export const NATIVE_TABLES = [
  'tasks', 'habits', 'habitCompletions', 'quickNotes', 'moods', 'diaryEntries', 'wishlist', 'friendMessages',
] as const;
export type NativeTable = (typeof NATIVE_TABLES)[number];

/** Tabelle che sul server diventano documenti della collezione con lo stesso nome. */
export const DOCUMENT_TABLES = [
  'settings', 'categories', 'lists', 'events', 'notebooks', 'notes', 'folders', 'files', 'sheets', 'calcHistory',
  'focus', 'dayLogs', 'beauty', 'looks', 'routine',
] as const;
export type DocumentTable = (typeof DOCUMENT_TABLES)[number];

export const SYNCED_TABLES = [...NATIVE_TABLES, ...DOCUMENT_TABLES] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

/** Tutto ciò che va nei backup. */
export const DATA_TABLES = [...SYNCED_TABLES, 'fileBlobs', 'localSettings'] as const;
export type DataTable = (typeof DATA_TABLES)[number];

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const h = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Istante ISO sempre crescente: due modifiche ravvicinate non sono mai "pari". */
let lastStamp = 0;
export function stamp(): string {
  const t = Math.max(Date.now(), lastStamp + 1);
  lastStamp = t;
  return new Date(t).toISOString();
}

/* ——— tracciamento automatico delle modifiche ———
 * Ogni scrittura fatta dall'app su una tabella sincronizzata alza `_dirty` e
 * aggiorna `_cu`. Le cancellazioni lasciano una "lapide" da mandare al server.
 * Le scritture che arrivano dal server avvengono in transazioni marcate come
 * remote e non vengono tracciate (altrimenti rimbalzerebbero all'infinito). */

const REMOTE = '__ninaRemote';
export function markRemote(tx: Transaction): void {
  (tx as unknown as Record<string, boolean>)[REMOTE] = true;
}
function isRemote(tx: Transaction | undefined): boolean {
  return Boolean(tx && (tx as unknown as Record<string, boolean>)[REMOTE]);
}

/** Avvisato a ogni modifica locale: il motore di sincronizzazione si mette in moto. */
let onLocalChange: (() => void) | null = null;
export function setLocalChangeListener(fn: (() => void) | null): void {
  onLocalChange = fn;
}
/* L'avviso parte dopo, fuori dalla transazione in corso: chi lo riceve legge
 * altre tabelle, e dentro la transazione non potrebbe. */
let changeTimer: ReturnType<typeof setTimeout> | null = null;
function queueLocalChange() {
  if (changeTimer) return;
  changeTimer = setTimeout(() => { changeTimer = null; onLocalChange?.(); }, 0);
}

/* Le lapidi si scrivono subito dopo, fuori dalla transazione che ha cancellato
 * (che può non includere la tabella delle lapidi). */
const pendingTombs: Tombstone[] = [];
let tombTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleTombs() {
  if (tombTimer) return;
  tombTimer = setTimeout(() => {
    tombTimer = null;
    const batch = pendingTombs.splice(0);
    if (batch.length) void db.tombstones.bulkPut(batch).then(() => queueLocalChange());
  }, 0);
}
/** Per i test e per chi deve essere sicuro che le lapidi siano scritte. */
export async function flushTombstones(): Promise<void> {
  if (tombTimer) { clearTimeout(tombTimer); tombTimer = null; }
  const batch = pendingTombs.splice(0);
  if (batch.length) await db.tombstones.bulkPut(batch);
}

for (const name of SYNCED_TABLES) {
  const table = db.table(name);
  table.hook('creating', function (_pk, obj: Record<string, unknown>, tx) {
    if (isRemote(tx)) return;
    obj._dirty = 1;
    obj._cu = stamp();
    this.onsuccess = () => queueLocalChange();
  });
  table.hook('updating', function (mods, _pk, _obj, tx) {
    if (isRemote(tx)) return undefined;
    this.onsuccess = () => queueLocalChange();
    const keys = Object.keys(mods);
    if (keys.length && keys.every((k) => k === '_dirty' || k === '_cu')) return undefined;
    return { _dirty: 1, _cu: stamp() };
  });
  table.hook('deleting', function (pk, _obj, tx) {
    if (isRemote(tx)) return;
    const id = String(pk);
    const at = stamp();
    this.onsuccess = () => {
      pendingTombs.push({ key: `${name}:${id}`, table: name, id, at });
      scheduleTombs();
    };
  });
}

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Studio', color: '#bfa8e8', order: 0 },
  { name: 'Lavoro', color: '#7fb5e0', order: 1 },
  { name: 'Personale', color: '#f2b880', order: 2 },
  { name: 'Salute', color: '#86c9a8', order: 3 },
  { name: 'Amici', color: '#f39cc0', order: 4 },
  { name: 'Beauty', color: '#e88aa3', order: 5 },
];

/**
 * Le categorie predefinite si creano solo la prima volta, e solo se dopo il
 * primo collegamento al server non ne sono arrivate altre (altrimenti ogni
 * dispositivo nuovo aggiungerebbe le sue copie).
 */
export async function ensureDefaults(): Promise<void> {
  const done = await db.localSettings.get('defaultsCreated');
  if (done) return;
  if ((await db.categories.count()) === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c, id: uid() })));
  }
  await db.localSettings.put({ key: 'defaultsCreated', value: true });
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}
