import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from './db';

export interface Settings {
  // ——— seguono la persona su tutti i dispositivi
  name: string;
  greeting: string;
  quote: string;
  quoteAuthor: string;
  rotateQuotes: boolean;
  theme: 'rosa' | 'lavanda' | 'cielo' | 'pesca' | 'notte';
  accent: string;
  hearts: boolean;
  defaultReminder: number;
  weekStartsMonday: boolean;
  dashboardWidgets: string[];
  favoriteFonts: string[];
  recentFonts: string[];
  editorFont: string;
  editorFontSize: number;
  editorLineHeight: number;
  editorPaper: 'blank' | 'lines' | 'grid' | 'dots';
  editorWidth: 'narrow' | 'normal' | 'wide';
  spellcheck: boolean;
  focusMinutes: number;
  breakMinutes: number;
  waterGoal: number;
  backupReminderDays: number;
  // ——— solo su questo dispositivo
  notifications: boolean;
  pinHash: string;
  pinSalt: string;
  lockAfterMinutes: number;
  autoSnapshot: boolean;
  lastSnapshotAt: number;
  lastExportAt: number;
  pencilOnly: boolean;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  greeting: 'auto',
  quote: 'Un passo alla volta, ma ogni giorno.',
  quoteAuthor: '',
  rotateQuotes: true,
  theme: 'rosa',
  accent: '#e46f8e',
  hearts: true,
  defaultReminder: 30,
  weekStartsMonday: true,
  dashboardWidgets: ['today', 'tasks', 'mood', 'calendar', 'events', 'quick', 'countdown', 'notes', 'selfcare', 'beauty', 'study', 'files', 'calc'],
  favoriteFonts: ['Playfair Display', 'Caveat', 'Lora', 'Poppins'],
  recentFonts: [],
  editorFont: 'Lora',
  editorFontSize: 17,
  editorLineHeight: 1.7,
  editorPaper: 'lines',
  editorWidth: 'normal',
  spellcheck: true,
  focusMinutes: 25,
  breakMinutes: 5,
  waterGoal: 8,
  backupReminderDays: 7,
  notifications: true,
  pinHash: '',
  pinSalt: '',
  lockAfterMinutes: 0,
  autoSnapshot: true,
  lastSnapshotAt: 0,
  lastExportAt: 0,
  pencilOnly: false,
  onboarded: false,
};

/** Restano sul dispositivo: un PIN o un permesso non hanno senso altrove. */
export const LOCAL_KEYS = new Set<keyof Settings>([
  'notifications', 'pinHash', 'pinSalt', 'lockAfterMinutes', 'autoSnapshot', 'lastSnapshotAt', 'lastExportAt',
  'pencilOnly', 'onboarded',
]);

export async function getSettings(): Promise<Settings> {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  // se due dispositivi hanno creato la stessa chiave, vince la modifica più recente
  const rows = (await db.settings.toArray()).sort((a, b) => (a._cu ?? '').localeCompare(b._cu ?? ''));
  for (const r of rows) out[r.key] = r.value;
  for (const r of await db.localSettings.toArray()) if (LOCAL_KEYS.has(r.key as keyof Settings)) out[r.key] = r.value;
  return out as unknown as Settings;
}

export async function setSettings(partial: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.settings, db.localSettings, async () => {
    for (const [key, value] of Object.entries(partial)) {
      if (LOCAL_KEYS.has(key as keyof Settings)) {
        await db.localSettings.put({ key, value });
        continue;
      }
      const existing = await db.settings.where('key').equals(key).toArray();
      if (existing.length) {
        await db.settings.update(existing[0].id, { value });
        for (const extra of existing.slice(1)) await db.settings.delete(extra.id);
      } else {
        await db.settings.add({ id: uid(), key, value });
      }
    }
  });
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await setSettings({ [key]: value } as Partial<Settings>);
}

export function useSettings(): Settings {
  return useLiveQuery(getSettings, []) ?? DEFAULT_SETTINGS;
}

export function useSettingsLoaded(): Settings | undefined {
  return useLiveQuery(getSettings, []);
}

/** Valori locali non legati alle impostazioni (token, server…). */
export async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const r = await db.localSettings.get(key);
  return (r?.value as T) ?? fallback;
}
export async function setLocal(key: string, value: unknown): Promise<void> {
  await db.localSettings.put({ key, value });
}
