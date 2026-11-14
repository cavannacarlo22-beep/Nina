import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Award, BookOpen, Coffee, Pause, Play, RotateCcw, SkipForward, Target, Timer } from 'lucide-react';
import { db, uid } from '../db/db';
import { setSettings, useSettings } from '../db/settings';
import { addDays, fromISO, toISO, todayISO } from '../lib/dates';
import { showSystemNotification } from '../lib/notify';
import { useUI } from '../components/ui';

export default function Studio() {
  return (
    <div className="page">
      <div className="page-head"><div><h1>Studio</h1><p>Un timer per concentrarti e il tempo che dedichi a ogni quaderno. Al tuo ritmo.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', alignItems: 'start' }}>
        <Focus />
        <PerQuaderno />
      </div>
    </div>
  );
}

/** Il timer vive fuori dalla pagina: se cambi sezione continua a contare. */
const timerState = { endAt: 0, mode: 'focus' as 'focus' | 'break', running: false, notebookId: '' as string, label: '' };

function Focus() {
  const s = useSettings();
  const ui = useUI();
  const notebooks = useLiveQuery(() => db.notebooks.filter((n) => !n.archived).toArray(), []) ?? [];
  const [mode, setMode] = useState(timerState.mode);
  const [running, setRunning] = useState(timerState.running);
  const [notebookId, setNotebookId] = useState(timerState.notebookId);
  const [label, setLabel] = useState(timerState.label);
  const total = (mode === 'focus' ? s.focusMinutes : s.breakMinutes) * 60;
  const [left, setLeft] = useState(() => (timerState.running ? Math.max(0, Math.round((timerState.endAt - Date.now()) / 1000)) : total));
  const sessionsToday = useLiveQuery(() => db.focus.where('date').equals(todayISO()).count(), []) ?? 0;
  const tick = useRef<number | null>(null);

  useEffect(() => { Object.assign(timerState, { mode, running, notebookId, label }); }, [mode, running, notebookId, label]);
  useEffect(() => { if (!running) setLeft(total); }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = async (m: typeof mode) => {
    setRunning(false);
    timerState.endAt = 0;
    if (m === 'focus') {
      const nb = notebooks.find((n) => n.id === notebookId);
      await db.focus.add({ id: uid(), date: todayISO(), minutes: s.focusMinutes, label: label || nb?.title || '', notebookId: notebookId || null, createdAt: Date.now() });
      ui.toast('Sessione completata! Pausa meritata ☕');
      void showSystemNotification('Sessione di studio completata', 'È il momento di una pausa.');
      setMode('break');
    } else {
      ui.toast('Pausa finita: si riparte 💪');
      void showSystemNotification('Pausa finita', 'Pronta per un’altra sessione?');
      setMode('focus');
    }
  };

  useEffect(() => {
    if (!running) return;
    if (!timerState.endAt) timerState.endAt = Date.now() + left * 1000;
    tick.current = window.setInterval(() => {
      const rem = Math.max(0, Math.round((timerState.endAt - Date.now()) / 1000));
      setLeft(rem);
      if (rem === 0) { clearInterval(tick.current!); void finish(mode); }
    }, 500);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    if (running) { setRunning(false); timerState.endAt = 0; } else setRunning(true);
  };
  const reset = () => { setRunning(false); timerState.endAt = 0; setLeft(total); };
  const skip = () => { setRunning(false); timerState.endAt = 0; setMode(mode === 'focus' ? 'break' : 'focus'); };
  const pct = 1 - left / total;
  const R = 108;
  const C = 2 * Math.PI * R;

  return (
    <div className="card">
      <div className="card-head">
        <h3><Timer size={18} />Concentrazione</h3>
        <div className="seg">
          <button className={mode === 'focus' ? 'active' : ''} onClick={() => !running && setMode('focus')}>Studio</button>
          <button className={mode === 'break' ? 'active' : ''} onClick={() => !running && setMode('break')}><Coffee size={13} style={{ verticalAlign: -2 }} /> Pausa</button>
        </div>
      </div>
      <div className="ring" style={{ margin: '8px auto 16px', width: 250, height: 250 }}>
        <svg width="250" height="250">
          <circle cx="125" cy="125" r={R} stroke="var(--surface-3)" strokeWidth="14" fill="none" />
          <circle cx="125" cy="125" r={R} stroke={mode === 'focus' ? 'var(--primary)' : 'var(--blue)'} strokeWidth="14" fill="none" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset .5s linear' }} />
        </svg>
        <div className="center">
          <div className="timer-big">{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</div>
          <div className="small muted">{mode === 'focus' ? 'concentrazione' : 'pausa'} · {sessionsToday} oggi</div>
        </div>
      </div>
      <div className="field-row" style={{ marginBottom: 12 }}>
        <select className="select" value={notebookId} onChange={(e) => setNotebookId(e.target.value)} disabled={running}>
          <option value="">Senza quaderno</option>
          {notebooks.map((n) => <option key={n.id} value={n.id}>{n.cover.emoji} {n.title}</option>)}
        </select>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Argomento (facoltativo)" />
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={toggle} style={{ minWidth: 140 }}>{running ? <><Pause size={18} />Pausa</> : <><Play size={18} />Avvia</>}</button>
        <button className="btn" onClick={reset} aria-label="Azzera"><RotateCcw size={16} /></button>
        <button className="btn" onClick={skip} aria-label="Salta"><SkipForward size={16} /></button>
      </div>
      <div className="row small" style={{ justifyContent: 'center', marginTop: 12, gap: 14 }}>
        <label className="row">Studio <input className="input" type="number" min={5} max={180} value={s.focusMinutes} onChange={(e) => setSettings({ focusMinutes: Math.max(1, Number(e.target.value) || 25) })} style={{ width: 70, minHeight: 36 }} /> min</label>
        <label className="row">Pausa <input className="input" type="number" min={1} max={60} value={s.breakMinutes} onChange={(e) => setSettings({ breakMinutes: Math.max(1, Number(e.target.value) || 5) })} style={{ width: 70, minHeight: 36 }} /> min</label>
      </div>
      <WeekChart />
    </div>
  );
}

function WeekChart() {
  const week = useLiveQuery(async () => {
    const days = Array.from({ length: 7 }, (_, i) => toISO(addDays(new Date(), i - 6)));
    const rows = await db.focus.where('date').anyOf(days).toArray();
    return days.map((d) => ({ d, m: rows.filter((r) => r.date === d).reduce((x, r) => x + r.minutes, 0) }));
  }, []) ?? [];
  const max = Math.max(60, ...week.map((w) => w.m));
  const total = week.reduce((a, w) => a + w.m, 0);
  const days = week.filter((w) => w.m > 0).length;
  return (
    <>
      <div className="divider" />
      <div className="row between"><b className="small"><Award size={14} style={{ verticalAlign: -2 }} /> Ultimi 7 giorni</b><span className="small muted">{total} min · {days} {days === 1 ? 'giorno' : 'giorni'} di studio</span></div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110, marginTop: 10 }}>
        {week.map((w) => (
          <div key={w.d} style={{ flex: 1, textAlign: 'center' }}>
            <div title={`${w.m} min`} style={{ height: Math.max(4, (w.m / max) * 84), background: w.d === todayISO() ? 'var(--primary)' : 'var(--primary-soft)', borderRadius: 8 }} />
            <div className="tiny muted" style={{ marginTop: 4 }}>{fromISO(w.d).toLocaleDateString('it-IT', { weekday: 'narrow' })}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function PerQuaderno() {
  const [days, setDays] = useState(30);
  const data = useLiveQuery(async () => {
    const from = toISO(addDays(new Date(), -(days - 1)));
    const sessions = (await db.focus.toArray()).filter((f) => f.date >= from);
    const nbs = await db.notebooks.toArray();
    const notes = await db.notes.toArray();
    const by = new Map<string, number>();
    for (const s of sessions) by.set(s.notebookId ?? '', (by.get(s.notebookId ?? '') ?? 0) + s.minutes);
    const rows = nbs.filter((n) => !n.archived).map((n) => {
      const nNotes = notes.filter((x) => x.notebookId === n.id);
      const words = nNotes.reduce((a, x) => a + (x.text ? x.text.split(/\s+/).filter(Boolean).length : 0), 0);
      const last = nNotes.reduce((a, x) => Math.max(a, x.updatedAt), 0);
      return { n, minutes: by.get(n.id) ?? 0, chapters: nNotes.length, words, last };
    }).sort((a, b) => b.minutes - a.minutes || b.last - a.last);
    return { rows, other: by.get('') ?? 0, total: sessions.reduce((a, s) => a + s.minutes, 0) };
  }, [days]);
  if (!data) return null;
  const max = Math.max(1, ...data.rows.map((r) => r.minutes));
  return (
    <div className="card">
      <div className="card-head">
        <h3><Target size={18} />I tuoi quaderni</h3>
        <select className="select" style={{ width: 'auto', minHeight: 36 }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7 giorni</option><option value={30}>30 giorni</option><option value={90}>3 mesi</option><option value={365}>1 anno</option>
        </select>
      </div>
      <p className="small muted" style={{ marginTop: -6 }}>Tempo di studio totale: <b>{Math.floor(data.total / 60)}h {data.total % 60}′</b></p>
      {data.rows.length === 0 && <p className="small muted">Crea un quaderno per ogni argomento che studi: qui vedrai quanto tempo gli dedichi.</p>}
      {data.rows.map(({ n, minutes, chapters, words, last }) => (
        <Link key={n.id} to={`/quaderni/${n.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="list-emoji" style={{ background: n.cover.color + '66' }}>{n.cover.emoji}</span>
          <div className="grow">
            <div className="row between"><b className="ellipsis">{n.title}</b><span className="small">{minutes ? `${Math.floor(minutes / 60) ? Math.floor(minutes / 60) + 'h ' : ''}${minutes % 60}′` : ''}</span></div>
            <div className="progress" style={{ height: 6, margin: '4px 0' }}><div style={{ width: `${(minutes / max) * 100}%`, background: n.cover.color }} /></div>
            <div className="tiny muted"><BookOpen size={10} style={{ verticalAlign: -1 }} /> {chapters} capitoli · {words.toLocaleString('it-IT')} parole{last ? ` · scritto il ${new Date(last).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : ''}</div>
          </div>
        </Link>
      ))}
      {data.other > 0 && <p className="tiny muted">Più {data.other} minuti senza quaderno.</p>}
    </div>
  );
}
