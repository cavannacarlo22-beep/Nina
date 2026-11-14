import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Flame, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { db, uid } from '../db/db';
import type { Habit } from '../db/types';
import { addDays, isSameDay, startOfWeek, toISO, todayISO } from '../lib/dates';
import { bestStreak, currentStreak, scheduledOn, toggleHabit } from '../lib/wellbeing';
import * as voce from '../content/voce';
import { Empty, Modal, Swatches, useUI } from '../components/ui';

const ICONS = ['💧', '📖', '🧘‍♀️', '🏃‍♀️', '🥗', '💤', '🧴', '💊', '✍️', '🎧', '🌿', '📵', '🦷', '🚶‍♀️', '🍎', '☀️', '🧹', '💅', '🎨', '🗣️'];
const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

export default function Abitudini() {
  const ui = useUI();
  const habits = useLiveQuery(() => db.habits.orderBy('sortOrder').toArray(), []) ?? [];
  const completions = useLiveQuery(() => db.habitCompletions.toArray(), []) ?? [];
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [edit, setEdit] = useState<Habit | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byHabit = new Map<string, Set<string>>();
  for (const c of completions) {
    if (!c.completed) continue;
    if (!byHabit.has(c.habitId)) byHabit.set(c.habitId, new Set());
    byHabit.get(c.habitId)!.add(c.date);
  }
  const today = todayISO();
  const todayDue = habits.filter((h) => scheduledOn(h, today));
  const todayDone = todayDue.filter((h) => byHabit.get(h.id)?.has(today)).length;

  const toggle = async (h: Habit, date: string) => {
    if (date > today) return;
    const before = currentStreak(h, byHabit.get(h.id) ?? new Set());
    const on = await toggleHabit(h, date);
    if (on && date === today) ui.toast(voce.streak(before + 1));
  };
  const blank = (): Habit => ({ id: '', name: '', icon: '💧', color: '#7fbfe8', frequency: 'DAILY', targetDays: [1, 2, 3, 4, 5, 6, 7], targetPerWeek: null, reminderTime: null, sortOrder: habits.length, createdAt: new Date().toISOString() });

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Abitudini</h1><p>{habits.length ? `Oggi: ${todayDone} di ${todayDue.length}. ${voce.incoraggiamento()}` : voce.nienteAbitudini()}</p></div>
        <button className="btn btn-primary" onClick={() => setEdit(blank())}><Plus size={18} />Nuova abitudine</button>
      </div>

      {habits.length === 0 ? (
        <div className="card"><Empty icon={<Sparkles size={48} color="var(--primary)" />} title="Una alla volta" text="Bere acqua, leggere dieci pagine, skincare, una passeggiata… scegli la prima." action={<button className="btn btn-primary" onClick={() => setEdit(blank())}><Plus size={16} />Aggiungi</button>} /></div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', marginBottom: 20 }}>
            {habits.map((h) => {
              const done = byHabit.get(h.id) ?? new Set<string>();
              const streak = currentStreak(h, done);
              const best = bestStreak(h, done);
              const doneToday = done.has(today);
              const due = scheduledOn(h, today);
              const brokeYesterday = streak === 0 && best > 0;
              return (
                <div key={h.id} className="card" style={{ borderColor: doneToday ? h.color : undefined }}>
                  <div className="row">
                    <span className="list-emoji" style={{ background: h.color + '33', fontSize: '1.4rem' }}>{h.icon}</span>
                    <div className="grow">
                      <b>{h.name}</b>
                      <div className="tiny muted">{h.frequency === 'CUSTOM' ? h.targetDays.map((d) => WEEKDAYS[d - 1]).join(' ') : h.frequency === 'WEEKLY' ? `${h.targetPerWeek} volte a settimana` : 'Ogni giorno'}</div>
                    </div>
                    <button className="icon-btn sm" onClick={() => setEdit(h)} aria-label="Modifica"><Pencil size={15} /></button>
                  </div>
                  <div className="row" style={{ marginTop: 14, gap: 10 }}>
                    <Flame size={20} color={streak ? '#f2a35e' : 'var(--muted)'} />
                    <div className="grow small">{brokeYesterday ? voce.streakInterrotto() : voce.streak(streak)}<div className="tiny muted">record: {best} {best === 1 ? 'giorno' : 'giorni'}</div></div>
                  </div>
                  <button className={'btn btn-block ' + (doneToday ? 'btn-primary' : 'btn-soft')} style={{ marginTop: 12, ...(doneToday ? { background: h.color, borderColor: h.color } : {}) }}
                    onClick={() => toggle(h, today)} disabled={!due && !doneToday}>
                    {doneToday ? 'Fatto oggi ✓' : due ? 'Segna come fatto' : 'Oggi riposo'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="card">
            <div className="card-head">
              <h3>La settimana</h3>
              <div className="row" style={{ gap: 2 }}>
                <button className="icon-btn sm" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Settimana precedente"><ChevronLeft size={16} /></button>
                <button className="btn btn-sm btn-ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>Questa</button>
                <button className="icon-btn sm" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Settimana successiva"><ChevronRight size={16} /></button>
              </div>
            </div>
            <div className="habit-grid">
              <span />
              {days.map((d) => <div key={d.toISOString()} className="tiny muted" style={{ textAlign: 'center', fontWeight: isSameDay(d, new Date()) ? 800 : 500 }}>{d.toLocaleDateString('it-IT', { weekday: 'narrow' })}<br />{d.getDate()}</div>)}
              {habits.map((h) => (
                <HabitWeekRow key={h.id} h={h} days={days} done={byHabit.get(h.id) ?? new Set()} onToggle={toggle} />
              ))}
            </div>
          </div>
        </>
      )}
      {edit && <HabitEditor h={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function HabitWeekRow({ h, days, done, onToggle }: { h: Habit; days: Date[]; done: Set<string>; onToggle: (h: Habit, d: string) => void }) {
  return (
    <>
      <div className="row" style={{ gap: 6, minWidth: 0 }}><span>{h.icon}</span><span className="ellipsis small" style={{ fontWeight: 600 }}>{h.name}</span></div>
      {days.map((d) => {
        const iso = toISO(d);
        const on = done.has(iso);
        const planned = scheduledOn(h, iso);
        return (
          <button key={iso} className={'habit-cell' + (on ? ' on' : '')} disabled={iso > todayISO()}
            style={on ? { background: h.color } : { opacity: planned ? 1 : 0.35 }} onClick={() => onToggle(h, iso)} aria-label={`${h.name} ${d.toLocaleDateString('it-IT')}`}>
            {on ? '✓' : ''}
          </button>
        );
      })}
    </>
  );
}

function HabitEditor({ h, onClose }: { h: Habit; onClose: () => void }) {
  const ui = useUI();
  const [x, setX] = useState(h);
  const save = async () => {
    if (!x.name.trim()) { ui.toast('Dai un nome all’abitudine', true); return; }
    const rec: Habit = { ...x, name: x.name.trim().slice(0, 80), id: x.id || uid() };
    if (rec.frequency === 'WEEKLY' && !rec.targetPerWeek) rec.targetPerWeek = 3;
    if (rec.frequency !== 'WEEKLY') rec.targetPerWeek = null;
    if (rec.frequency === 'CUSTOM' && rec.targetDays.length === 0) rec.targetDays = [1, 3, 5];
    if (!/^#[0-9a-f]{6}$/i.test(rec.color)) rec.color = '#7fbfe8';
    await db.habits.put(rec);
    onClose();
  };
  const remove = async () => {
    if (await ui.confirm({ title: `Eliminare “${h.name}”?`, message: 'Anche lo storico dei giorni fatti verrà eliminato.', ok: 'Elimina', danger: true })) {
      await db.transaction('rw', db.habits, db.habitCompletions, async () => {
        await db.habitCompletions.where('habitId').equals(h.id).delete();
        await db.habits.delete(h.id);
      });
      onClose();
    }
  };
  return (
    <Modal title={h.id ? 'Modifica abitudine' : 'Nuova abitudine'} onClose={onClose} footer={<>
      {h.id && <button className="btn btn-danger" onClick={remove}><Trash2 size={16} />Elimina</button>}
      <span className="grow" />
      <button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={save}>Salva</button>
    </>}>
      <div className="stack">
        <input className="input" autoFocus value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} placeholder="Es. Leggere 20 minuti" onKeyDown={(e) => e.key === 'Enter' && save()} />
        <div className="chips">{ICONS.map((e) => <button key={e} className={'chip' + (x.icon === e ? ' active' : '')} style={{ fontSize: '1.15rem', padding: '0 9px' }} onClick={() => setX({ ...x, icon: e })}>{e}</button>)}</div>
        <Swatches value={x.color} onChange={(c) => setX({ ...x, color: c })} />
        <div className="field"><span>Quando</span>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            <button className={x.frequency === 'DAILY' ? 'active' : ''} onClick={() => setX({ ...x, frequency: 'DAILY' })}>Ogni giorno</button>
            <button className={x.frequency === 'CUSTOM' ? 'active' : ''} onClick={() => setX({ ...x, frequency: 'CUSTOM' })}>Alcuni giorni</button>
            <button className={x.frequency === 'WEEKLY' ? 'active' : ''} onClick={() => setX({ ...x, frequency: 'WEEKLY', targetPerWeek: x.targetPerWeek ?? 3 })}>N volte a settimana</button>
          </div>
        </div>
        {x.frequency === 'CUSTOM' && (
          <div className="chips">{WEEKDAYS.map((w, i) => {
            const on = x.targetDays.includes(i + 1);
            return <button key={i} className={'chip' + (on ? ' active' : '')} onClick={() => setX({ ...x, targetDays: on ? x.targetDays.filter((d) => d !== i + 1) : [...x.targetDays, i + 1].sort() })}>{w}</button>;
          })}</div>
        )}
        {x.frequency === 'WEEKLY' && (
          <label className="row">Volte a settimana <input className="input" type="number" min={1} max={7} value={x.targetPerWeek ?? 3} onChange={(e) => setX({ ...x, targetPerWeek: Math.max(1, Math.min(7, Number(e.target.value) || 1)) })} style={{ width: 80 }} /></label>
        )}
      </div>
    </Modal>
  );
}
