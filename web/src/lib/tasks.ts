import { db, uid } from '../db/db';
import type { Task, TaskCategory } from '../db/types';
import { addDays, addMonths, fromISO, toISO, todayISO } from './dates';

export const CATEGORIES: { id: TaskCategory; label: string; emoji: string; color: string }[] = [
  { id: 'PERSONALE', label: 'Personale', emoji: '🌸', color: '#f39cc0' },
  { id: 'STUDIO', label: 'Studio', emoji: '📚', color: '#bfa8e8' },
  { id: 'LAVORO', label: 'Lavoro', emoji: '💼', color: '#7fbfe8' },
  { id: 'CASA', label: 'Casa', emoji: '🏡', color: '#8fd0b0' },
  { id: 'SPORT', label: 'Sport', emoji: '🏃‍♀️', color: '#f2a35e' },
  { id: 'SHOPPING', label: 'Shopping', emoji: '🛍️', color: '#e88aa3' },
  { id: 'SOCIAL', label: 'Amici', emoji: '🥂', color: '#f6bf95' },
  { id: 'ALTRO', label: 'Altro', emoji: '✨', color: '#a8868f' },
];
export const categoryInfo = (c: TaskCategory) => CATEGORIES.find((x) => x.id === c) ?? CATEGORIES[CATEGORIES.length - 1];

export const PRIORITIES = [
  { id: 'LOW', label: 'Bassa', color: '#7fbfe8' },
  { id: 'MEDIUM', label: 'Media', color: '#f2a35e' },
  { id: 'HIGH', label: 'Alta', color: '#e46f8e' },
] as const;

export function blankTask(p: Partial<Task> = {}): Task {
  return {
    id: '', title: '', description: null, date: null, time: null, isCompleted: false, priority: 'MEDIUM', category: 'PERSONALE',
    notes: null, repeatType: 'NEVER', repeatDays: [], repeatUntil: null, seriesId: null, notificationEnabled: false,
    notificationMinutesBefore: 15, completedAt: null, listId: null, sortOrder: 0, createdAt: new Date().toISOString(), ...p,
  };
}

const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;

/** Il giorno della prossima occorrenza di un'attività che si ripete, o null. */
export function nextOccurrence(t: Pick<Task, 'date' | 'repeatType' | 'repeatDays' | 'repeatUntil'>): string | null {
  if (!t.date || t.repeatType === 'NEVER') return null;
  const d = fromISO(t.date);
  let next: Date;
  switch (t.repeatType) {
    case 'DAILY': next = addDays(d, 1); break;
    case 'WEEKLY': next = addDays(d, 7); break;
    case 'MONTHLY': next = addMonths(d, 1); break;
    case 'CUSTOM': {
      const days = t.repeatDays.length ? t.repeatDays : [isoWeekday(d)];
      next = addDays(d, 1);
      for (let i = 0; i < 7 && !days.includes(isoWeekday(next)); i++) next = addDays(next, 1);
      break;
    }
    default: return null;
  }
  const iso = toISO(next);
  if (t.repeatUntil && iso > t.repeatUntil) return null;
  return iso;
}

/**
 * Spunta (o toglie la spunta) a un'attività. Se si ripete, al completamento
 * nasce la prossima occorrenza: come i promemoria del telefono.
 */
export async function toggleTask(t: Task): Promise<'done' | 'undone'> {
  if (t.isCompleted) {
    await db.tasks.update(t.id, { isCompleted: false, completedAt: null });
    return 'undone';
  }
  await db.transaction('rw', db.tasks, async () => {
    await db.tasks.update(t.id, { isCompleted: true, completedAt: new Date().toISOString() });
    const next = nextOccurrence(t);
    if (next) {
      const seriesId = t.seriesId ?? t.id;
      if (!t.seriesId) await db.tasks.update(t.id, { seriesId });
      const exists = await db.tasks.filter((x) => x.seriesId === seriesId && x.date === next).count();
      if (!exists) {
        await db.tasks.add({ ...blankTask(t), id: uid(), date: next, seriesId, isCompleted: false, completedAt: null, createdAt: new Date().toISOString() });
      }
    }
  });
  return 'done';
}

export async function saveTask(t: Task): Promise<string> {
  const rec: Task = {
    ...t,
    title: t.title.trim(),
    id: t.id || uid(),
    // una ripetizione ha bisogno di un giorno da cui partire
    date: t.repeatType !== 'NEVER' && !t.date ? todayISO() : t.date,
    completedAt: t.isCompleted ? t.completedAt ?? new Date().toISOString() : null,
  };
  if (rec.repeatType === 'CUSTOM' && rec.repeatDays.length === 0) rec.repeatType = 'WEEKLY';
  if (!t.id) {
    const max = (await db.tasks.filter((x) => x.listId === rec.listId).toArray()).reduce((m, x) => Math.max(m, x.sortOrder), -1);
    rec.sortOrder = max + 1;
  }
  await db.tasks.put(rec);
  return rec.id;
}

export function dueLabel(t: Task): string {
  if (!t.date) return '';
  const today = todayISO();
  const tomorrow = toISO(addDays(new Date(), 1));
  const label = t.date === today ? 'Oggi' : t.date === tomorrow ? 'Domani' : fromISO(t.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  return t.time ? `${label} · ${t.time}` : label;
}
