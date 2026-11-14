import { db } from '../db/db';
import { getSettings } from '../db/settings';
import { addDays, expand } from './dates';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function askNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

export async function showSystemNotification(title: string, body: string): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) {
      await reg.showNotification(title, { body, icon: './icon-192.png', badge: './icon-192.png', tag: title + body });
    } else {
      new Notification(title, { body, icon: './icon-192.png' });
    }
    return true;
  } catch {
    return false;
  }
}

export interface DueReminder {
  key: string;
  title: string;
  body: string;
}

/**
 * Finds event reminders that are due now and not yet notified,
 * marks them as notified and returns them.
 */
export async function collectDueReminders(now = Date.now()): Promise<DueReminder[]> {
  const settings = await getSettings();
  if (!settings.notifications) return [];
  const events = await db.events.toArray();
  const from = addDays(new Date(now), -1);
  const to = addDays(new Date(now), 2);
  const due: DueReminder[] = [];
  // ciò che è già stato notificato resta su questo dispositivo: non serve sincronizzarlo
  const shown = new Set(((await db.localSettings.get('notifiedEvents'))?.value as string[] | undefined) ?? []);
  let shownChanged = false;
  for (const occ of expand(events, from, to)) {
    const ev = occ.event;
    if (ev.reminder === null) continue;
    const fireAt = occ.start - ev.reminder * 60000;
    const key = `${ev.id}|${occ.date}|${ev.startTime}|${ev.reminder}`;
    if (now >= fireAt && now <= occ.end && !shown.has(key)) {
      const mins = Math.round((occ.start - now) / 60000);
      const when = ev.allDay ? 'oggi' : mins > 0 ? `tra ${mins} min (${ev.startTime})` : `adesso (${ev.startTime})`;
      due.push({ key, title: ev.title, body: `${when}${ev.location ? ' · ' + ev.location : ''}` });
      shown.add(key);
      shownChanged = true;
    }
  }
  if (shownChanged) await db.localSettings.put({ key: 'notifiedEvents', value: [...shown].slice(-300) });

  // attività con promemoria
  const today = new Date(now);
  const tasks = await db.tasks.filter((t) => !t.isCompleted && t.notificationEnabled && !!t.date && !!t.time).toArray();
  const done = new Set(((await db.localSettings.get('notifiedTasks'))?.value as string[] | undefined) ?? []);
  let changed = false;
  for (const t of tasks) {
    const [y, m, d] = t.date!.split('-').map(Number);
    const [hh, mm] = t.time!.split(':').map(Number);
    const at = new Date(y, m - 1, d, hh, mm).getTime();
    const key = `${t.id}|${t.date}|${t.time}`;
    if (done.has(key)) continue;
    if (now >= at - t.notificationMinutesBefore * 60000 && now <= at + 30 * 60000) {
      due.push({ key, title: t.title, body: t.notificationMinutesBefore ? `tra ${Math.max(0, Math.round((at - now) / 60000))} min (${t.time})` : `adesso (${t.time})` });
      done.add(key);
      changed = true;
    }
  }
  if (changed) await db.localSettings.put({ key: 'notifiedTasks', value: [...done].slice(-200) });
  void today;
  return due;
}
