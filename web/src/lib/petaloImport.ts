/**
 * Converte un backup di Petalo (la versione precedente, solo locale) nel
 * formato di Nina, così niente di quello che è stato scritto lì va perso.
 *
 * Cosa cambia:
 *  - le voci delle liste diventano attività (con la loro lista);
 *  - i promemoria diventano note "da ricordare";
 *  - abitudini e spunte prendono la forma del server di Nina;
 *  - umore e diario di ogni giorno diventano mood e pagine di diario;
 *  - gli id numerici (storico calcoli, sessioni di studio) diventano UUID;
 *  - il contenuto dei file passa nella tabella dei file;
 *  - il libretto esami non esiste più e viene tralasciato.
 */
import { uid } from '../db/db';
import type { MoodKind } from '../db/types';

type Row = Record<string, unknown>;
const arr = (v: unknown) => (Array.isArray(v) ? (v as Row[]) : []);
const MOOD_FROM_SCORE: Record<number, MoodKind> = { 1: 'GIU', 2: 'STANCA', 3: 'COSI_COSI', 4: 'BENE', 5: 'FANTASTICA' };
const PRIO: Record<number, string> = { 0: 'MEDIUM', 1: 'LOW', 2: 'MEDIUM', 3: 'HIGH' };
const CAT_FROM_KIND: Record<string, string> = { studio: 'STUDIO', lavoro: 'LAVORO', casa: 'CASA', personale: 'PERSONALE', spesa: 'SHOPPING', viaggi: 'PERSONALE' };
const iso = (ms: unknown) => new Date(typeof ms === 'number' ? ms : Date.now()).toISOString();

export function convertPetaloData(data: Record<string, unknown>): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  const lists = arr(data.lists);
  const kindOf = new Map(lists.map((l) => [l.id, String(l.kind ?? '')]));

  out.lists = lists;
  out.tasks = arr(data.items).map((i) => ({
    id: i.id, title: String(i.text ?? '').slice(0, 200) || 'Senza titolo', description: null, date: i.dueDate || null, time: null,
    isCompleted: !!i.done, priority: PRIO[Number(i.priority ?? 0)] ?? 'MEDIUM', category: CAT_FROM_KIND[kindOf.get(i.listId) ?? ''] ?? 'ALTRO',
    notes: i.note || null, repeatType: 'NEVER', repeatDays: [], repeatUntil: null, seriesId: null, notificationEnabled: false,
    notificationMinutesBefore: 15, completedAt: i.done ? iso(i.completedAt ?? i.createdAt) : null, listId: i.listId ?? null,
    sortOrder: Number(i.order ?? 0), createdAt: iso(i.createdAt),
  }));
  out.quickNotes = arr(data.memos).map((m) => ({ id: m.id, content: String(m.text ?? '').slice(0, 1000) || '…', convertedTaskId: null, createdAt: iso(m.createdAt) }));

  out.habits = arr(data.habits).map((h, n) => ({
    id: h.id, name: String(h.name ?? '').slice(0, 80) || 'Abitudine', icon: h.emoji ?? '✨', color: /^#[0-9a-f]{6}$/i.test(String(h.color)) ? h.color : '#7fbfe8',
    frequency: 'DAILY', targetDays: [1, 2, 3, 4, 5, 6, 7], targetPerWeek: null, reminderTime: null, sortOrder: Number(h.order ?? n), createdAt: iso(h.createdAt),
  }));
  out.habitCompletions = arr(data.habitLogs).map((l) => ({ id: uid(), habitId: l.habitId, date: l.date, completed: true }));

  const moods: Row[] = [];
  const diary: Row[] = [];
  const dayLogs: Row[] = [];
  for (const d of arr(data.dayLogs)) {
    const date = String(d.date);
    if (Number(d.mood) >= 1) moods.push({ id: uid(), mood: MOOD_FROM_SCORE[Number(d.mood)] ?? 'COSI_COSI', note: null, date });
    if (String(d.journal ?? '').trim()) diary.push({ id: uid(), title: null, content: String(d.journal), mood: MOOD_FROM_SCORE[Number(d.mood)] ?? null, entryDate: date, createdAt: new Date().toISOString() });
    dayLogs.push({ id: uid(), date, water: Number(d.water ?? 0), sleep: Number(d.sleep ?? 0), period: !!d.period, gratitude: String(d.gratitude ?? ''), routineDone: [], updatedAt: Date.now() });
  }
  out.moods = moods;
  out.diaryEntries = diary;
  out.dayLogs = dayLogs;

  out.calcHistory = arr(data.calcHistory).map((c) => ({ ...c, id: uid() }));
  out.focus = arr(data.focus).map((f) => ({ ...f, id: uid(), notebookId: null }));
  for (const t of ['categories', 'events', 'sheets', 'folders', 'notebooks', 'notes']) out[t] = arr(data[t]);
  out.events = arr(data.events).map((e) => ({ ...e, notified: [] }));

  // i file di Petalo avevano il contenuto dentro la riga
  out.files = arr(data.files).map(({ blob: _b, ...meta }) => meta);
  out.fileBlobs = arr(data.files).map((f) => ({ id: f.id, uploaded: 0 }));

  out.settings = arr(data.settings)
    .filter((s) => !['pinHash', 'pinSalt', 'graduationScale', 'lastSnapshotAt', 'lastExportAt', 'onboarded', 'notifications', 'pencilOnly', 'autoSnapshot', 'lockAfterMinutes', 'dashboardWidgets'].includes(String(s.key)))
    .map((s) => ({ id: uid(), key: s.key, value: s.value }));
  return out;
}
