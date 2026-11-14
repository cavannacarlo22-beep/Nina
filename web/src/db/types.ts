/**
 * Il modello dei dati di Nina.
 *
 * Due famiglie:
 *  - le entità "native" del server (attività, abitudini, mood, diario,
 *    wishlist, note veloci, messaggi con l'amica): stessi nomi e stessi campi
 *    delle API, così la sincronizzazione non deve tradurre niente;
 *  - i "documenti": tutto il resto (quaderni, agenda, archivio, tabelle,
 *    beauty…). Sul server stanno nella tabella `documents` con la loro
 *    collezione; qui ognuno ha la sua tabella.
 *
 * Ogni riga sincronizzabile ha due campi locali:
 *  - `_dirty` = 1 finché la modifica non è arrivata al server;
 *  - `_cu`    = quando è stata fatta sul dispositivo (decide i conflitti).
 */

export type ID = string;

export interface SyncLocal {
  _dirty?: 0 | 1;
  _cu?: string;
}

/* ———————————————— entità native ———————————————— */

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type RepeatType = 'NEVER' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type TaskCategory = 'LAVORO' | 'CASA' | 'PERSONALE' | 'SPORT' | 'STUDIO' | 'SHOPPING' | 'SOCIAL' | 'ALTRO';

export interface Task extends SyncLocal {
  id: ID;
  title: string;
  description: string | null;
  /** `YYYY-MM-DD` oppure null per le voci di una lista senza scadenza */
  date: string | null;
  /** `HH:mm` */
  time: string | null;
  isCompleted: boolean;
  priority: Priority;
  category: TaskCategory;
  notes: string | null;
  repeatType: RepeatType;
  /** 1 = lunedì … 7 = domenica */
  repeatDays: number[];
  repeatUntil: string | null;
  seriesId: string | null;
  notificationEnabled: boolean;
  notificationMinutesBefore: number;
  completedAt: string | null;
  listId: ID | null;
  sortOrder: number;
  createdAt: string;
}

export type HabitFrequency = 'DAILY' | 'WEEKLY' | 'CUSTOM';

export interface Habit extends SyncLocal {
  id: ID;
  name: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  targetDays: number[];
  targetPerWeek: number | null;
  reminderTime: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface HabitCompletion extends SyncLocal {
  id: ID;
  habitId: ID;
  date: string;
  completed: boolean;
}

export type MoodKind = 'FANTASTICA' | 'BENE' | 'COSI_COSI' | 'STANCA' | 'GIU' | 'NERVOSA';

export interface Mood extends SyncLocal {
  id: ID;
  mood: MoodKind;
  note: string | null;
  date: string;
}

export interface DiaryEntry extends SyncLocal {
  id: ID;
  title: string | null;
  content: string;
  mood: MoodKind | null;
  entryDate: string;
  createdAt: string;
}

export type WishCategory = 'MODA' | 'BEAUTY' | 'CASA' | 'TECH' | 'VIAGGI' | 'LIBRI' | 'ESPERIENZE' | 'ALTRO';

export interface WishItem extends SyncLocal {
  id: ID;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  productUrl: string | null;
  category: WishCategory;
  isPurchased: boolean;
  purchasedAt: string | null;
  createdAt: string;
}

export interface QuickNote extends SyncLocal {
  id: ID;
  content: string;
  convertedTaskId: ID | null;
  createdAt: string;
}

export interface FriendMessage extends SyncLocal {
  id: ID;
  author: 'USER' | 'NINA';
  content: string;
  createdAt: string;
}

/* ———————————————— documenti ———————————————— */

export interface Category extends SyncLocal {
  id: ID;
  name: string;
  color: string;
  order: number;
}

export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CalEvent extends SyncLocal {
  id: ID;
  title: string;
  description: string;
  notes: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  categoryId: ID | null;
  reminder: number | null;
  repeat: Repeat;
  /** mostra il conto alla rovescia in Home */
  countdown?: boolean;
  notified: string[];
  createdAt: number;
  updatedAt: number;
}

export type ListKind = 'studio' | 'lavoro' | 'casa' | 'personale' | 'spesa' | 'viaggi' | 'beauty' | 'altro';

export interface TodoList extends SyncLocal {
  id: ID;
  title: string;
  kind: ListKind;
  color: string;
  emoji: string;
  order: number;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Sheet extends SyncLocal {
  id: ID;
  name: string;
  rows: number;
  cols: number;
  cells: Record<string, string>;
  formats: Record<string, { bold?: boolean; align?: 'left' | 'center' | 'right'; bg?: string; decimals?: number }>;
  colWidths: Record<number, number>;
  createdAt: number;
  updatedAt: number;
}

export interface CalcEntry extends SyncLocal {
  id: ID;
  expression: string;
  result: string;
  source: 'calcolatrice' | 'tabella';
  createdAt: number;
}

export interface Folder extends SyncLocal {
  id: ID;
  name: string;
  parentId: ID | null;
  color: string;
  createdAt: number;
}

export type FileCategory = 'pdf' | 'word' | 'excel' | 'immagine' | 'presentazione' | 'testo' | 'audio' | 'video' | 'archivio' | 'altro';

/** Metadati di un file: viaggiano con la sincronizzazione. */
export interface FileRec extends SyncLocal {
  id: ID;
  name: string;
  folderId: ID | null;
  mime: string;
  size: number;
  category: FileCategory;
  favorite: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Il contenuto di un file, solo su questo dispositivo.
 * `uploaded` = 1 quando il server ce l'ha già.
 */
export interface FileBlob {
  id: ID;
  blob: Blob;
  uploaded: 0 | 1;
}

export type Paper = 'blank' | 'lines' | 'grid' | 'dots';

export interface NotebookCover {
  color: string;
  pattern: 'hearts' | 'dots' | 'stripes' | 'grid' | 'plain' | 'flowers';
  emoji: string;
  image?: string;
}

export interface Notebook extends SyncLocal {
  id: ID;
  title: string;
  subject: string;
  professor: string;
  cover: NotebookCover;
  paper: Paper;
  order: number;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Note extends SyncLocal {
  id: ID;
  notebookId: ID;
  parentId: ID | null;
  title: string;
  content: unknown;
  text: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  openedAt: number;
}

export interface FocusSession extends SyncLocal {
  id: ID;
  date: string;
  minutes: number;
  label: string;
  notebookId: ID | null;
  createdAt: number;
}

/** Acqua, sonno, ciclo, gratitudine e routine di un giorno. */
export interface DayLog extends SyncLocal {
  id: ID;
  date: string;
  water: number;
  sleep: number;
  period: boolean;
  gratitude: string;
  /** passi della routine skincare spuntati in quel giorno */
  routineDone: string[];
  updatedAt: number;
}

export type BeautyCategory =
  | 'viso' | 'occhi' | 'labbra' | 'guance' | 'sopracciglia' | 'unghie' | 'skincare' | 'capelli' | 'profumi' | 'strumenti' | 'altro';

export interface BeautyProduct extends SyncLocal {
  id: ID;
  name: string;
  brand: string;
  category: BeautyCategory;
  shade: string;
  /** colore indicativo della tonalità */
  swatch: string;
  /** `YYYY-MM-DD` del giorno in cui è stato aperto */
  openedAt: string;
  /** mesi di durata dopo l'apertura (il barattolino "12M") */
  paoMonths: number | null;
  /** scadenza stampata sulla confezione */
  expiresAt: string;
  price: number | null;
  rating: number;
  favorite: boolean;
  finished: boolean;
  notes: string;
  image: string;
  createdAt: number;
}

export interface Look extends SyncLocal {
  id: ID;
  title: string;
  occasion: string;
  steps: string;
  productIds: ID[];
  image: string;
  rating: number;
  favorite: boolean;
  createdAt: number;
}

export interface RoutineStep extends SyncLocal {
  id: ID;
  when: 'mattina' | 'sera';
  name: string;
  productId: ID | null;
  /** 1 = lunedì … 7 = domenica; vuoto = tutti i giorni */
  days: number[];
  order: number;
}

/** Impostazioni che seguono la persona su tutti i dispositivi. */
export interface SettingRow extends SyncLocal {
  id: ID;
  key: string;
  value: unknown;
}

/** Impostazioni che restano su questo dispositivo (PIN, permessi, server…). */
export interface LocalSetting {
  key: string;
  value: unknown;
}

export interface Tombstone {
  /** `${table}:${id}` */
  key: string;
  table: string;
  id: ID;
  at: string;
}

export interface Snapshot {
  id?: number;
  createdAt: number;
  size: number;
  data: string;
}
