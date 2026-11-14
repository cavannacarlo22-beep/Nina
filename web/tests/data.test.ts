// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { db, uid } from '../src/db/db';
import { getSettings, setSettings } from '../src/db/settings';
import { createBackupZip, restoreBackup, restoreSnapshot, takeSnapshot } from '../src/lib/backup';
import { decryptBytes, encryptBytes, hashPin } from '../src/lib/crypto';
import { addDays, expand, toISO } from '../src/lib/dates';
import { toICS } from '../src/lib/ics';
import { blankTask, nextOccurrence, saveTask, toggleTask } from '../src/lib/tasks';
import { bestStreak, currentStreak, cycleInfo, setMood } from '../src/lib/wellbeing';
import { expiryOf, expiryState } from '../src/lib/beauty';
import { blankProduct } from '../src/pages/Beauty';
import type { CalEvent, Habit } from '../src/db/types';

const ev = (p: Partial<CalEvent>): CalEvent => ({
  id: uid(), title: 'Parrucchiera', description: '', notes: '', location: '', date: '2026-11-10', startTime: '10:00', endTime: '12:00', allDay: false,
  categoryId: null, reminder: 30, repeat: 'none', notified: [], createdAt: 0, updatedAt: 0, ...p,
});
const tick = () => new Promise((r) => setTimeout(r, 20));

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('salvataggio persistente', () => {
  it('impostazioni: quelle personali si sincronizzano, quelle del dispositivo no', async () => {
    expect((await getSettings()).theme).toBe('rosa');
    await setSettings({ name: 'Giulia', theme: 'lavanda', pinHash: 'x' });
    const s = await getSettings();
    expect(s.name).toBe('Giulia');
    expect(s.theme).toBe('lavanda');
    expect(await db.settings.where('key').equals('name').count()).toBe(1);
    expect(await db.settings.where('key').equals('pinHash').count()).toBe(0);
    expect((await db.localSettings.get('pinHash'))?.value).toBe('x');
    await setSettings({ name: 'Giuly' });
    expect(await db.settings.where('key').equals('name').count()).toBe(1);
  });

  it('ogni modifica viene segnata da inviare, ogni cancellazione lascia una lapide', async () => {
    const id = await saveTask(blankTask({ title: 'Comprare il latte' }));
    const t = await db.tasks.get(id);
    expect(t?._dirty).toBe(1);
    expect(t?._cu).toBeTruthy();
    await db.tasks.delete(id);
    await tick();
    expect(await db.tombstones.get(`tasks:${id}`)).toBeTruthy();
  });

  it('backup completo con file e ripristino', async () => {
    await db.events.add(ev({ title: 'Dentista' }));
    await db.lists.add({ id: 'l1', title: 'Spesa', kind: 'spesa', color: '#fff', emoji: '🛒', order: 0, pinned: false, createdAt: 1, updatedAt: 1 });
    const tid = await saveTask(blankTask({ title: 'Latte', listId: 'l1' }));
    await db.files.add({ id: 'f1', name: 'slide.pdf', folderId: null, mime: 'application/pdf', size: 5, category: 'pdf', favorite: false, tags: [], createdAt: 1, updatedAt: 1 });
    await db.fileBlobs.add({ id: 'f1', blob: new Blob(['%PDF-'], { type: 'application/pdf' }), uploaded: 1 });
    const zip = await createBackupZip();
    const parsed = await JSZip.loadAsync(await zip.arrayBuffer());
    expect(parsed.file('files/f1')).toBeTruthy();

    await db.events.clear();
    await db.tasks.clear();
    await db.fileBlobs.clear();
    await restoreBackup(zip);
    expect((await db.events.toArray())[0].title).toBe('Dentista');
    expect((await db.tasks.get(tid))?.title).toBe('Latte');
    expect((await db.fileBlobs.get('f1'))?.blob.size).toBe(5);
    // dopo un ripristino tutto riparte verso il server
    expect((await db.tasks.get(tid))?._dirty).toBe(1);
    expect((await db.fileBlobs.get('f1'))?.uploaded).toBe(0);
  });

  it('il backup non contiene la sessione dell’account', async () => {
    await db.localSettings.put({ key: 'session', value: { refreshToken: 'segreto' } });
    const zip = await JSZip.loadAsync(await (await createBackupZip()).arrayBuffer());
    expect(await zip.file('data.json')!.async('string')).not.toContain('segreto');
  });

  it('backup cifrato richiede la password giusta', async () => {
    await db.quickNotes.add({ id: 'm1', content: 'Chiamare la segreteria', convertedTaskId: null, createdAt: '2026-01-01' });
    const zip = new Uint8Array(await (await createBackupZip()).arrayBuffer());
    const enc = await encryptBytes(zip, 'segreta123');
    await expect(decryptBytes(enc, 'sbagliata')).rejects.toThrow('Password errata');
    await db.quickNotes.clear();
    await restoreBackup(new Blob([enc]), 'segreta123');
    expect((await db.quickNotes.get('m1'))?.content).toBe('Chiamare la segreteria');
  });

  it('copie automatiche e ripristino', async () => {
    await db.notebooks.add({ id: 'n1', title: 'Inglese', subject: '', professor: '', cover: { color: '#f00', pattern: 'hearts', emoji: '📒' }, paper: 'lines', order: 0, archived: false, createdAt: 1, updatedAt: 1 });
    await takeSnapshot();
    await db.notebooks.update('n1', { title: 'Cambiato' });
    const [snap] = await db.snapshots.toArray();
    await restoreSnapshot(snap.id!);
    expect((await db.notebooks.get('n1'))?.title).toBe('Inglese');
  });

  it('hash del PIN stabile e diverso per sale diverso', async () => {
    expect(await hashPin('1234', 'a')).toBe(await hashPin('1234', 'a'));
    expect(await hashPin('1234', 'a')).not.toBe(await hashPin('1234', 'b'));
  });
});

describe('cose da fare', () => {
  it('ripetizioni: prossima occorrenza', () => {
    expect(nextOccurrence({ date: '2026-11-13', repeatType: 'DAILY', repeatDays: [], repeatUntil: null })).toBe('2026-11-14');
    expect(nextOccurrence({ date: '2026-01-31', repeatType: 'MONTHLY', repeatDays: [], repeatUntil: null })).toBe('2026-02-28');
    // venerdì 13 → lunedì e mercoledì
    expect(nextOccurrence({ date: '2026-11-13', repeatType: 'CUSTOM', repeatDays: [1, 3], repeatUntil: null })).toBe('2026-11-16');
    expect(nextOccurrence({ date: '2026-11-13', repeatType: 'WEEKLY', repeatDays: [], repeatUntil: '2026-11-15' })).toBeNull();
  });

  it('completare un’attività che si ripete crea la prossima, una volta sola', async () => {
    const id = await saveTask(blankTask({ title: 'Palestra', date: '2026-11-13', repeatType: 'WEEKLY' }));
    await toggleTask((await db.tasks.get(id))!);
    const all = await db.tasks.toArray();
    expect(all).toHaveLength(2);
    const next = all.find((t) => t.id !== id)!;
    expect(next.date).toBe('2026-11-20');
    expect(next.isCompleted).toBe(false);
    expect(next.seriesId).toBe(id);
    // togli e rimetti la spunta: niente doppioni
    await toggleTask((await db.tasks.get(id))!);
    await toggleTask((await db.tasks.get(id))!);
    expect(await db.tasks.count()).toBe(2);
  });

  it('una ripetizione senza giorno parte da oggi', async () => {
    const id = await saveTask(blankTask({ title: 'Bere acqua', repeatType: 'DAILY' }));
    expect((await db.tasks.get(id))?.date).toBeTruthy();
  });
});

describe('agenda', () => {
  it('ripetizioni settimanali', () => {
    const occ = expand([ev({ date: '2026-11-02', repeat: 'weekly' })], new Date(2026, 10, 1), new Date(2026, 10, 30));
    expect(occ.map((o) => o.date)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
  });
  it('eventi singoli nell’intervallo', () => {
    const today = new Date(2026, 10, 13);
    const occ = expand([ev({ date: toISO(today) }), ev({ date: toISO(addDays(today, 40)) })], today, addDays(today, 7));
    expect(occ).toHaveLength(1);
  });
  it('esportazione .ics per il Calendario Apple', () => {
    const ics = toICS([ev({ title: 'Ricevimento, prof', repeat: 'monthly' })]);
    expect(ics).toContain('SUMMARY:Ricevimento\\, prof');
    expect(ics).toContain('DTSTART:20261110T100000');
    expect(ics).toContain('RRULE:FREQ=MONTHLY');
    expect(ics).toContain('TRIGGER:-PT30M');
  });
});

describe('benessere, abitudini, beauty', () => {
  it('un solo mood al giorno', async () => {
    await setMood('2026-11-13', 'BENE');
    await setMood('2026-11-13', 'STANCA');
    const all = await db.moods.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].mood).toBe('STANCA');
    await setMood('2026-11-13', null);
    expect(await db.moods.count()).toBe(0);
  });

  it('serie di giorni consecutivi delle abitudini', () => {
    const h: Habit = { id: 'h', name: 'Leggere', icon: '📖', color: '#7fbfe8', frequency: 'DAILY', targetDays: [1, 2, 3, 4, 5, 6, 7], targetPerWeek: null, reminderTime: null, sortOrder: 0, createdAt: '' };
    const d = (n: number) => toISO(addDays(new Date(), -n));
    expect(currentStreak(h, new Set([d(0), d(1), d(2), d(4)]))).toBe(3);
    expect(currentStreak(h, new Set([d(1), d(2)]))).toBe(2); // oggi non ancora fatto: la serie resta viva
    expect(bestStreak(h, new Set([d(10), d(9), d(8), d(7), d(1)]))).toBe(4);
  });

  it('previsione del ciclo', () => {
    const info = cycleInfo(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-29', '2026-08-30', '2026-09-26', '2026-09-27']);
    expect(info.starts).toEqual(['2026-08-01', '2026-08-29', '2026-09-26']);
    expect(info.avg).toBe(28);
    expect(info.next).toBe('2026-10-24');
  });

  it('scadenza dei trucchi: vince la data più vicina fra confezione e apertura', () => {
    expect(expiryOf({ openedAt: '2026-01-15', paoMonths: 6, expiresAt: '' })).toBe('2026-07-15');
    expect(expiryOf({ openedAt: '2026-01-15', paoMonths: 12, expiresAt: '2026-06-01' })).toBe('2026-06-01');
    expect(expiryOf({ openedAt: '', paoMonths: null, expiresAt: '' })).toBeNull();
    const old = blankProduct({ openedAt: toISO(addDays(new Date(), -200)), paoMonths: 6 });
    expect(expiryState(old).state).toBe('scaduto');
    const soon = blankProduct({ expiresAt: toISO(addDays(new Date(), 10)) });
    expect(expiryState(soon).state).toBe('presto');
  });
});
