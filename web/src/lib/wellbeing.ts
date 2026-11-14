import { db, uid } from '../db/db';
import type { DayLog, Habit, HabitCompletion, MoodKind } from '../db/types';
import { addDays, fromISO, toISO, todayISO } from './dates';

export const MOODS: { id: MoodKind; emoji: string; label: string; score: number; color: string }[] = [
  { id: 'FANTASTICA', emoji: '🤩', label: 'Fantastica', score: 5, color: '#f39cc0' },
  { id: 'BENE', emoji: '🙂', label: 'Bene', score: 4, color: '#8fd0b0' },
  { id: 'COSI_COSI', emoji: '😐', label: 'Così così', score: 3, color: '#e8c56b' },
  { id: 'STANCA', emoji: '😴', label: 'Stanca', score: 2, color: '#a8b5e0' },
  { id: 'GIU', emoji: '😔', label: 'Giù', score: 1, color: '#7fbfe8' },
  { id: 'NERVOSA', emoji: '😤', label: 'Nervosa', score: 1, color: '#e46f8e' },
];
export const moodInfo = (m: MoodKind | null | undefined) => MOODS.find((x) => x.id === m);
export const isPositive = (m: MoodKind) => m === 'FANTASTICA' || m === 'BENE';

/** Un solo mood per giorno: se c'è già si aggiorna. */
export async function setMood(date: string, mood: MoodKind | null, note?: string | null): Promise<void> {
  const existing = await db.moods.where('date').equals(date).toArray();
  if (!mood) {
    await db.moods.bulkDelete(existing.map((m) => m.id));
    return;
  }
  if (existing.length) {
    await db.moods.update(existing[0].id, { mood, ...(note !== undefined ? { note } : {}) });
    if (existing.length > 1) await db.moods.bulkDelete(existing.slice(1).map((m) => m.id));
  } else {
    await db.moods.add({ id: uid(), date, mood, note: note ?? null });
  }
}

/* ——— giornata: acqua, sonno, ciclo, gratitudine, routine ——— */

export const emptyDay = (date: string): DayLog => ({ id: '', date, water: 0, sleep: 0, period: false, gratitude: '', routineDone: [], updatedAt: 0 });

export async function getDay(date: string): Promise<DayLog | undefined> {
  const rows = await db.dayLogs.where('date').equals(date).toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export async function patchDay(date: string, patch: Partial<DayLog>): Promise<void> {
  const cur = await getDay(date);
  if (cur) await db.dayLogs.update(cur.id, { ...patch, updatedAt: Date.now() });
  else await db.dayLogs.add({ ...emptyDay(date), ...patch, id: uid(), updatedAt: Date.now() });
}

/* ——— abitudini ——— */

const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;

/** L'abitudine è prevista in quel giorno? (per le settimanali: tutti i giorni valgono) */
export function scheduledOn(h: Habit, date: string): boolean {
  if (h.frequency === 'CUSTOM') return h.targetDays.includes(isoWeekday(fromISO(date)));
  return true;
}

/** Giorni consecutivi di completamento, contando da oggi (o da ieri se oggi non è ancora fatta). */
export function currentStreak(h: Habit, done: Set<string>): number {
  let d = new Date();
  if (!done.has(toISO(d))) d = addDays(d, -1);
  let n = 0;
  for (let i = 0; i < 1000; i++) {
    const iso = toISO(d);
    if (!scheduledOn(h, iso)) { d = addDays(d, -1); continue; }
    if (!done.has(iso)) break;
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(h: Habit, done: Set<string>): number {
  const dates = [...done].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const iso of dates) {
    if (prev) {
      let gap = addDays(fromISO(prev), 1);
      while (!scheduledOn(h, toISO(gap)) && toISO(gap) < iso) gap = addDays(gap, 1);
      run = toISO(gap) === iso ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = iso;
  }
  return best;
}

export async function toggleHabit(h: Habit, date = todayISO()): Promise<boolean> {
  const rows = await db.habitCompletions.where('habitId').equals(h.id).filter((c) => c.date === date).toArray();
  if (rows.length) {
    await db.habitCompletions.bulkDelete(rows.map((r) => r.id));
    return false;
  }
  const c: HabitCompletion = { id: uid(), habitId: h.id, date, completed: true };
  await db.habitCompletions.add(c);
  return true;
}

/* ——— ciclo ——— */

/** Raggruppa i giorni di ciclo e stima il prossimo. */
export function cycleInfo(periodDays: string[]) {
  const sorted = [...new Set(periodDays)].sort();
  const starts: string[] = [];
  let prev: Date | null = null;
  for (const d of sorted) {
    const cur = fromISO(d);
    if (!prev || (cur.getTime() - prev.getTime()) / 86400000 > 2) starts.push(d);
    prev = cur;
  }
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const len = Math.round((fromISO(starts[i]).getTime() - fromISO(starts[i - 1]).getTime()) / 86400000);
    if (len >= 18 && len <= 45) lengths.push(len);
  }
  const recent = lengths.slice(-6);
  const avg = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : 28;
  const last = starts[starts.length - 1];
  const next = last ? toISO(addDays(fromISO(last), avg)) : null;
  return { starts, avg, last, next, measured: recent.length > 0 };
}
