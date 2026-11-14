import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle, ArrowDown, ArrowUp, Bell, BookHeart, Calculator, CalendarHeart, Check, Clock, Eye, EyeOff, FileText, FolderHeart,
  GlassWater, Heart, Hourglass, ListChecks, Pencil, Plus, Shuffle, Sparkles, StickyNote, Timer, Wind, X,
} from 'lucide-react';
import { db, uid } from '../db/db';
import { setSettings, useSettings, type Settings } from '../db/settings';
import type { CalEvent } from '../db/types';
import { addDays, expand, fmtLong, fmtRelative, fromISO, isSameDay, timeLabel, toISO, todayISO } from '../lib/dates';
import { calc, formatValue } from '../lib/formula';
import { CATEGORY_COLOR, fmtSize } from '../lib/files';
import { blankTask, dueLabel, saveTask, toggleTask } from '../lib/tasks';
import { expiryState } from '../lib/beauty';
import { pensieroDelGiorno, riepilogoSera, saluto } from '../content/voce';
import * as voce from '../content/voce';
import { MiniCalendar } from '../components/MiniCalendar';
import { blankEvent, EventEditor } from '../components/EventEditor';
import { FileViewer } from '../components/FileViewer';
import { Empty, Modal, Swatches, useUI } from '../components/ui';
import { TinyHeart } from '../components/Hearts';
import { MoodPicker } from './Umore';
import { PensieroCard } from './Pensieri';
import { WaterTracker } from './Benessere';
import { randomIdea } from './SelfCare';
import { useTodayRoutine } from './Beauty';
import type { FileRec } from '../db/types';

const WIDGETS: Record<string, string> = {
  pensiero: 'Pensiero di oggi', today: 'Accesso rapido', tasks: 'Le cose di oggi', mood: 'Come stai', calendar: 'Calendario', events: 'Prossimi appuntamenti',
  quick: 'Da ricordare', countdown: 'Conto alla rovescia', notes: 'Ultimi appunti', selfcare: 'Un momento per te', beauty: 'Beauty',
  study: 'Studio', files: 'Documenti', calc: 'Calcolo veloce',
};
const SPAN: Record<string, string> = {
  pensiero: 'span-12', today: 'span-12', tasks: 'span-7', mood: 'span-5', calendar: 'span-4', events: 'span-8', quick: 'span-4', countdown: 'span-4',
  notes: 'span-4', selfcare: 'span-6', beauty: 'span-6', study: 'span-4', files: 'span-8', calc: 'span-4',
};

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Home() {
  const s = useSettings();
  const now = useClock();
  const [editing, setEditing] = useState(false);
  const [editHero, setEditHero] = useState(false);
  const greeting = s.greeting === 'auto' || !s.greeting ? saluto(s.name, now.getHours()) : `${s.greeting}${s.name ? `, ${s.name}` : ''}`;
  const quote = s.rotateQuotes ? pensieroDelGiorno(now) : { text: s.quote, author: s.quoteAuthor || null };
  // la frase di Nina sotto il saluto, come nell'app iPhone
  const ninaLine = useLiveQuery(async () => {
    const t = (await db.tasks.toArray()).filter((x) => x.date && (x.date === todayISO() || (x.date < todayISO() && !x.isCompleted)));
    const done = t.filter((x) => x.isCompleted).length;
    const left = t.length - done;
    if (now.getHours() >= 19) return riepilogoSera(done, left);
    if (!t.length) return `${voce.nienteAttivitaOggi()} ${voce.incoraggiamento()}`;
    return left === 0 ? voce.tutteFatte() : voce.rimaste(left);
  }, [now.getHours(), todayISO()]);

  const widgets = s.dashboardWidgets.includes('pensiero') || s.dashboardWidgets.includes('-pensiero') ? s.dashboardWidgets.filter((w) => WIDGETS[w]) : ['pensiero', ...s.dashboardWidgets.filter((w) => WIDGETS[w])];
  const hidden = Object.keys(WIDGETS).filter((w) => !widgets.includes(w));
  const move = (i: number, d: number) => {
    const arr = [...widgets];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    void setSettings({ dashboardWidgets: arr });
  };

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>{greeting} <TinyHeart size={22} /></h1>
          <div className="date">{fmtLong(now)}</div>
          {ninaLine && <div className="quote" style={{ fontStyle: 'normal', fontFamily: 'var(--font-ui)', fontWeight: 600, color: 'var(--primary-strong)' }}>{ninaLine}</div>}
          {!s.rotateQuotes && <div className="quote">“{quote.text}”{quote.author ? <span className="small"> — {quote.author}</span> : null}</div>}
        </div>
        <div className="clock">
          {now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          <small>Settimana {isoWeek(now)}</small>
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4 }}>
          <button className="icon-btn sm" onClick={() => setEditHero(true)} title="Personalizza saluto e frase"><Pencil size={16} /></button>
          <button className={'icon-btn sm' + (editing ? ' active' : '')} onClick={() => setEditing(!editing)} title="Modifica la dashboard">{editing ? <Check size={16} /> : <Eye size={16} />}</button>
        </div>
      </section>

      {editing && (
        <div className="card soft" style={{ marginTop: 16 }}>
          <div className="row between wrap"><b>Nascondi, mostra e riordina i riquadri.</b><button className="btn btn-sm btn-primary" onClick={() => setEditing(false)}>Fatto</button></div>
          {hidden.length > 0 && <div className="chips" style={{ marginTop: 12 }}>{hidden.map((w) => <button key={w} className="chip" onClick={() => setSettings({ dashboardWidgets: [...widgets, w] })}><Plus size={14} />{WIDGETS[w]}</button>)}</div>}
        </div>
      )}

      <div className="dash-grid">
        {widgets.map((w, i) => (
          <div key={w} className={SPAN[w]} style={{ position: 'relative', minWidth: 0 }}>
            {editing && (
              <div className="row" style={{ position: 'absolute', top: -10, right: 10, zIndex: 2, background: 'var(--surface)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: 2, gap: 0 }}>
                <button className="icon-btn sm" onClick={() => move(i, -1)} aria-label="Sposta prima"><ArrowUp size={16} /></button>
                <button className="icon-btn sm" onClick={() => move(i, 1)} aria-label="Sposta dopo"><ArrowDown size={16} /></button>
                <button className="icon-btn sm danger" onClick={() => setSettings({ dashboardWidgets: [...widgets.filter((x) => x !== w), ...(w === 'pensiero' ? ['-pensiero'] : [])] })} aria-label="Nascondi"><EyeOff size={16} /></button>
              </div>
            )}
            <Widget id={w} settings={s} />
          </div>
        ))}
      </div>
      {editHero && <HeroEditor s={s} onClose={() => setEditHero(false)} />}
    </div>
  );
}

function Widget({ id, settings }: { id: string; settings: Settings }) {
  switch (id) {
    case 'pensiero': return <PensieroCard />;
    case 'today': return <QuickAccess />;
    case 'tasks': return <TodayTasks />;
    case 'mood': return <MoodWidget goal={settings.waterGoal} />;
    case 'calendar': return <CalendarWidget monday={settings.weekStartsMonday} />;
    case 'events': return <EventsWidget />;
    case 'quick': return <QuickNotesWidget />;
    case 'countdown': return <CountdownWidget />;
    case 'notes': return <NotesWidget />;
    case 'selfcare': return <SelfCareWidget />;
    case 'beauty': return <BeautyWidget />;
    case 'study': return <StudyWidget />;
    case 'files': return <FilesWidget />;
    case 'calc': return <CalcWidget />;
  }
  return null;
}

function QuickAccess() {
  const [newEvent, setNewEvent] = useState(false);
  const s = useSettings();
  const items = [
    { to: '/cose', label: 'Cose da fare', icon: ListChecks, color: '#e46f8e' },
    { to: '/agenda', label: 'Agenda', icon: CalendarHeart, color: '#f39cc0' },
    { to: '/quaderni', label: 'Quaderni', icon: BookHeart, color: '#b49be0' },
    { to: '/umore', label: 'Diario', icon: Heart, color: '#7fbfe8' },
    { to: '/beauty', label: 'Beauty', icon: Sparkles, color: '#e88aa3' },
    { to: '/calcoli', label: 'Calcolatrice', icon: Calculator, color: '#f2a35e' },
    { to: '/archivio', label: 'Documenti', icon: FolderHeart, color: '#4caf84' },
  ];
  return (
    <div className="quick">
      <button onClick={() => setNewEvent(true)} style={{ background: 'var(--primary)', color: 'var(--on-primary)', borderColor: 'var(--primary)' }}>
        <span className="q-ico" style={{ background: 'rgba(255,255,255,.22)' }}><Plus size={20} /></span>Nuovo impegno
      </button>
      {items.map(({ to, label, icon: Icon, color }) => (
        <Link key={to} to={to}><span className="q-ico" style={{ background: color + '22', color }}><Icon size={20} /></span>{label}</Link>
      ))}
      {newEvent && <EventEditor event={blankEvent(todayISO(), undefined, s.defaultReminder)} onClose={() => setNewEvent(false)} />}
    </div>
  );
}

function TodayTasks() {
  const ui = useUI();
  const today = todayISO();
  const tasks = useLiveQuery(() => db.tasks.filter((t) => !!t.date && (t.date === today || (t.date < today && !t.isCompleted))).toArray(), [today]) ?? [];
  const [text, setText] = useState('');
  const open = tasks.filter((t) => !t.isCompleted).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '99').localeCompare(b.time ?? '99'));
  const done = tasks.filter((t) => t.isCompleted);
  const add = async () => {
    if (!text.trim()) return;
    await saveTask(blankTask({ title: text.trim(), date: today }));
    setText('');
  };
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head">
        <h3><ListChecks size={18} />Le cose di oggi</h3>
        <Link to="/cose" className="btn btn-sm btn-ghost">Tutte</Link>
      </div>
      <p className="small muted" style={{ marginTop: -8 }}>{open.length ? voce.rimaste(open.length) : done.length ? voce.tutteFatte() : voce.nienteAttivitaOggi()}</p>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Aggiungi per oggi…" />
        <button className="icon-btn" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }} aria-label="Aggiungi"><Plus size={20} /></button>
      </form>
      <div style={{ marginTop: 8 }}>
        {[...open, ...done].slice(0, 9).map((t) => {
          const late = !t.isCompleted && t.date! < today;
          return (
            <div key={t.id} className="list-row">
              <input type="checkbox" className="checkbox" checked={t.isCompleted} onChange={async () => { if ((await toggleTask(t)) === 'done') ui.toast(open.length === 1 ? voce.tutteFatte() : voce.attivitaFatta()); }} aria-label="Fatta" />
              <div className="grow">
                <div className="ellipsis" style={{ fontWeight: 500, textDecoration: t.isCompleted ? 'line-through' : undefined, color: t.isCompleted ? 'var(--muted)' : undefined }}>{t.title}</div>
                {(t.time || late) && <div className="tiny" style={{ color: late ? 'var(--danger)' : 'var(--muted)' }}>{late ? `${voce.attivitaScaduta()} · ${dueLabel(t)}` : t.time}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MoodWidget({ goal }: { goal: number }) {
  const water = useLiveQuery(async () => (await db.dayLogs.where('date').equals(todayISO()).toArray()).reduce((m, l) => Math.max(m, l.water), 0), []) ?? 0;
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head"><h3><Heart size={18} />Come stai oggi?</h3><Link to="/umore" className="btn btn-sm btn-ghost">Diario</Link></div>
      <MoodPicker date={todayISO()} compact />
      <div className="small muted" style={{ margin: '14px 0 4px' }}><GlassWater size={13} style={{ verticalAlign: -2 }} /> Acqua: {water}/{goal}</div>
      <WaterTracker date={todayISO()} goal={goal} size={24} />
    </div>
  );
}

function CalendarWidget({ monday }: { monday: boolean }) {
  const nav = useNavigate();
  const data = useLiveQuery(async () => {
    const all = await db.events.toArray();
    const cats = new Map((await db.categories.toArray()).map((c) => [c.id, c.color]));
    const from = addDays(new Date(), -45);
    const map = new Map<string, string[]>();
    for (const o of expand(all, from, addDays(from, 120))) map.set(o.date, [...(map.get(o.date) ?? []), cats.get(o.event.categoryId ?? '') ?? 'var(--primary)']);
    for (const t of await db.tasks.filter((t) => !!t.date && !t.isCompleted).toArray()) map.set(t.date!, [...(map.get(t.date!) ?? []), 'var(--blue)']);
    return map;
  }, []);
  return <div className="card"><MiniCalendar dots={data} monday={monday} onSelect={(d) => nav(`/agenda?d=${toISO(d)}&v=day`)} /></div>;
}

function EventsWidget() {
  const data = useLiveQuery(async () => {
    const all = await db.events.toArray();
    const cats = new Map((await db.categories.toArray()).map((c) => [c.id, c]));
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { occ: expand(all, from, addDays(from, 14)), cats };
  }, []);
  const [edit, setEdit] = useState<CalEvent | null>(null);
  const now = Date.now();
  const upcoming = (data?.occ ?? []).filter((o) => o.end >= now).slice(0, 6);
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head"><h3><CalendarHeart size={18} />Prossimi appuntamenti</h3><Link to="/agenda" className="btn btn-sm btn-ghost">Agenda</Link></div>
      {upcoming.length === 0 ? <Empty title="Nessun impegno in vista" text="Le prossime due settimane sono libere." /> : upcoming.map((o) => {
        const cat = data?.cats.get(o.event.categoryId ?? '');
        const d = fromISO(o.date);
        const label = isSameDay(d, new Date()) ? 'Oggi' : isSameDay(d, addDays(new Date(), 1)) ? 'Domani' : d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
        const soon = o.start - now < 3600000 && o.start > now;
        return (
          <button key={o.event.id + o.date} className="list-row" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px dashed var(--border)', textAlign: 'left' }} onClick={() => setEdit(o.event)}>
            <span className="dot" style={{ background: cat?.color ?? 'var(--primary)', width: 12, height: 12 }} />
            <div className="grow">
              <div className="ellipsis" style={{ fontWeight: 600 }}>{o.event.title}</div>
              <div className="small muted ellipsis">{label} · {timeLabel(o.event)}{o.event.location ? ' · ' + o.event.location : ''}</div>
            </div>
            {soon && <span className="badge"><Clock size={12} />a breve</span>}
            {o.event.reminder !== null && <Bell size={15} color="var(--muted)" />}
          </button>
        );
      })}
      {edit && <EventEditor event={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function QuickNotesWidget() {
  const notes = useLiveQuery(() => db.quickNotes.orderBy('createdAt').reverse().filter((n) => !n.convertedTaskId).limit(6).toArray(), []) ?? [];
  const [text, setText] = useState('');
  const add = async () => {
    if (!text.trim()) return;
    await db.quickNotes.add({ id: uid(), content: text.trim().slice(0, 1000), convertedTaskId: null, createdAt: new Date().toISOString() });
    setText('');
  };
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head"><h3><StickyNote size={18} />Da ricordare</h3><Link to="/cose" className="btn btn-sm btn-ghost">Tutte</Link></div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Devo ricordarmi di…" />
        <button className="icon-btn" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }} aria-label="Aggiungi"><Plus size={20} /></button>
      </form>
      <div style={{ marginTop: 8 }}>
        {notes.map((n) => (
          <div key={n.id} className="list-row" style={{ minHeight: 44 }}>
            <span className="grow">{n.content}</span>
            <button className="icon-btn sm" title="Diventa un’attività di oggi" onClick={async () => { const id = await saveTask(blankTask({ title: n.content.slice(0, 200), date: todayISO() })); await db.quickNotes.update(n.id, { convertedTaskId: id }); }}><Check size={15} /></button>
            <button className="icon-btn sm danger" onClick={() => db.quickNotes.delete(n.id)} aria-label="Elimina"><X size={15} /></button>
          </div>
        ))}
        {notes.length === 0 && <p className="small muted" style={{ textAlign: 'center' }}>{voce.nienteNote()}</p>}
      </div>
    </div>
  );
}

function CountdownWidget() {
  const items = useLiveQuery(async () => {
    const today = todayISO();
    const evs = (await db.events.filter((e) => !!e.countdown && e.date >= today).toArray()).sort((a, b) => a.date.localeCompare(b.date));
    return evs.slice(0, 4);
  }, []) ?? [];
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head"><h3><Hourglass size={18} />Conto alla rovescia</h3></div>
      {items.length === 0 ? <p className="small muted">Un viaggio, un concerto, un compleanno? Nell’appuntamento attiva “Conto alla rovescia in Home”.</p> : items.map((e) => {
        const days = Math.round((fromISO(e.date).getTime() - fromISO(todayISO()).getTime()) / 86400000);
        return (
          <div key={e.id} className="list-row">
            <div className="stat" style={{ minWidth: 64, alignItems: 'center' }}><b style={{ color: 'var(--primary-strong)' }}>{days}</b><span>{days === 1 ? 'giorno' : 'giorni'}</span></div>
            <div className="grow"><b>{e.title}</b><div className="tiny muted">{fromISO(e.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
          </div>
        );
      })}
    </div>
  );
}

function NotesWidget() {
  const data = useLiveQuery(async () => {
    const notes = await db.notes.orderBy('openedAt').reverse().limit(5).toArray();
    const nbs = new Map((await db.notebooks.toArray()).map((n) => [n.id, n]));
    return { notes, nbs };
  }, []);
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head"><h3><BookHeart size={18} />Ultimi appunti</h3><Link to="/quaderni" className="btn btn-sm btn-ghost">Quaderni</Link></div>
      {!data?.notes.length ? <Empty title="Nessun appunto ancora" text="Crea il tuo primo quaderno." /> : data.notes.map((n) => {
        const nb = data.nbs.get(n.notebookId);
        return (
          <Link key={n.id} to={`/quaderni/${n.notebookId}/${n.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="list-emoji" style={{ background: (nb?.cover.color ?? '#f6b3c4') + '55', width: 36, height: 36 }}>{nb?.cover.emoji ?? '📒'}</span>
            <div className="grow"><div className="ellipsis" style={{ fontWeight: 600 }}>{n.title || 'Senza titolo'}</div><div className="tiny muted ellipsis">{nb?.title} · {fmtRelative(n.openedAt || n.updatedAt)}</div></div>
          </Link>
        );
      })}
    </div>
  );
}

function SelfCareWidget() {
  const [idea, setIdea] = useState(() => randomIdea());
  const [invite] = useState(() => voce.inviteSelfCare());
  return (
    <div className="card" style={{ height: '100%', background: 'linear-gradient(135deg, var(--blue-soft), var(--surface) 70%)' }}>
      <div className="card-head"><h3><Sparkles size={18} />Un momento per te</h3><Link to="/selfcare" className="btn btn-sm btn-ghost"><Wind size={14} />Respira</Link></div>
      <p className="small" style={{ margin: '-6px 0 10px', color: 'var(--primary-strong)', fontWeight: 600 }}>{invite}</p>
      <b style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>{idea.title}</b>
      <p className="small muted" style={{ margin: '6px 0 12px' }}>{idea.description} · {idea.minutes} min</p>
      <button className="btn btn-sm btn-soft" onClick={() => setIdea(randomIdea(idea))}><Shuffle size={14} />Un’altra</button>
    </div>
  );
}

function BeautyWidget() {
  const products = useLiveQuery(() => db.beauty.filter((p) => !p.finished).toArray(), []) ?? [];
  const { todays, done, toggle } = useTodayRoutine();
  const expiring = products.map((p) => ({ p, e: expiryState(p) })).filter(({ e }) => e.state === 'presto' || e.state === 'scaduto').sort((a, b) => (a.e.days ?? 0) - (b.e.days ?? 0));
  const part = new Date().getHours() < 15 ? 'mattina' : 'sera';
  const now = todays.filter((s) => s.when === part);
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head"><h3><Sparkles size={18} />Beauty</h3><Link to="/beauty" className="btn btn-sm btn-ghost">Trousse</Link></div>
      {now.length > 0 && (
        <>
          <div className="small muted" style={{ marginBottom: 4 }}>Routine {part === 'mattina' ? 'del mattino' : 'della sera'}</div>
          <div className="chips" style={{ marginBottom: 12 }}>
            {now.map((s) => <button key={s.id} className={'chip' + (done.has(s.id) ? ' active' : '')} onClick={() => toggle(s)}>{done.has(s.id) ? '✓ ' : ''}{s.name}</button>)}
          </div>
        </>
      )}
      {expiring.length > 0 ? expiring.slice(0, 4).map(({ p, e }) => (
        <div key={p.id} className="list-row" style={{ minHeight: 40 }}>
          <AlertTriangle size={16} color={e.state === 'scaduto' ? 'var(--danger)' : 'var(--warning)'} />
          <span className="grow small"><b>{p.name}</b>{p.brand ? ` · ${p.brand}` : ''}</span>
          <span className="tiny" style={{ color: e.state === 'scaduto' ? 'var(--danger)' : 'var(--warning)' }}>{e.state === 'scaduto' ? 'scaduto' : `${e.days} gg`}</span>
        </div>
      )) : <p className="small muted">{products.length ? 'Nessun prodotto in scadenza 💄' : 'Aggiungi i tuoi prodotti: ti avviso quando scadono.'}</p>}
    </div>
  );
}

function StudyWidget() {
  const data = useLiveQuery(async () => {
    const today = todayISO();
    const sessions = await db.focus.where('date').equals(today).toArray();
    const week = (await db.focus.toArray()).filter((f) => f.date >= toISO(addDays(new Date(), -6)));
    return { today: sessions.reduce((s, f) => s + f.minutes, 0), n: sessions.length, week: week.reduce((s, f) => s + f.minutes, 0) };
  }, []);
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head"><h3><Timer size={18} />Studio</h3><Link to="/studio" className="btn btn-sm btn-ghost">Timer</Link></div>
      <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
        <div className="stat"><b>{data?.today ?? 0}′</b><span>oggi</span></div>
        <div className="stat"><b>{data?.n ?? 0}</b><span>sessioni</span></div>
        <div className="stat"><b>{Math.round((data?.week ?? 0) / 6) / 10}h</b><span>settimana</span></div>
      </div>
      <Link to="/studio" className="btn btn-soft btn-sm" style={{ marginTop: 14 }}><Timer size={14} />Inizia a studiare</Link>
    </div>
  );
}

function FilesWidget() {
  const [open, setOpen] = useState<FileRec | null>(null);
  const files = useLiveQuery(async () => {
    const fav = await db.files.filter((f) => f.favorite).toArray();
    const recent = await db.files.orderBy('createdAt').reverse().limit(8).toArray();
    const seen = new Set<string>();
    return [...fav, ...recent].filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true))).slice(0, 8);
  }, []);
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head"><h3><FolderHeart size={18} />Documenti</h3><Link to="/archivio" className="btn btn-sm btn-ghost">Archivio</Link></div>
      {!files?.length ? <Empty title="Archivio vuoto" text="PDF, Word, Excel, foto: restano salvati qui." /> : (
        <div className="file-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {files.map((f) => (
            <button key={f.id} className="file-tile" onClick={() => setOpen(f)} style={{ padding: 10 }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: CATEGORY_COLOR[f.category] + '22', color: CATEGORY_COLOR[f.category] }}><FileText size={18} /></span>
                <div className="grow"><div className="file-name">{f.name}</div><div className="file-meta">{fmtSize(f.size)}</div></div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && <FileViewer file={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CalcWidget() {
  const [expr, setExpr] = useState('');
  const result = useMemo(() => {
    if (!expr.trim()) return '';
    try { return '= ' + formatValue(calc(expr)); } catch { return '…'; }
  }, [expr]);
  const save = async () => {
    try {
      const v = calc(expr);
      await db.calcHistory.add({ id: uid(), expression: expr, result: formatValue(v), source: 'calcolatrice', createdAt: Date.now() });
      setExpr(String(v));
    } catch { /* ignore */ }
  };
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head"><h3><Calculator size={18} />Calcolo veloce</h3><Link to="/calcoli" className="btn btn-sm btn-ghost">Apri</Link></div>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }}><input className="input" inputMode="decimal" value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="Es. 49,90 - 30%" /></form>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginTop: 12, minHeight: 48, color: 'var(--primary-strong)', wordBreak: 'break-all' }}>{result}</div>
    </div>
  );
}

function HeroEditor({ s, onClose }: { s: Settings; onClose: () => void }) {
  const ui = useUI();
  const [name, setName] = useState(s.name);
  const [greeting, setGreeting] = useState(s.greeting === 'auto' ? '' : s.greeting);
  const [quote, setQuote] = useState(s.quote);
  const [author, setAuthor] = useState(s.quoteAuthor);
  const [rotate, setRotate] = useState(s.rotateQuotes);
  const [accent, setAccent] = useState(s.accent);
  const save = async () => {
    await setSettings({ name: name.trim(), greeting: greeting.trim() || 'auto', quote: quote.trim() || s.quote, quoteAuthor: author.trim(), rotateQuotes: rotate, accent });
    ui.toast('Fatto 💗');
    onClose();
  };
  return (
    <Modal title="Personalizza la tua home" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={save}>Salva</button></>}>
      <div className="stack">
        <label className="field"><span>Il tuo nome</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Come vuoi che ti chiami Nina?" /></label>
        <label className="field"><span>Saluto (vuoto = quello di Nina, che cambia con l’ora)</span><input className="input" value={greeting} onChange={(e) => setGreeting(e.target.value)} placeholder="Ciao bellissima" /></label>
        <div className="row"><input type="checkbox" className="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} id="rot" /><label htmlFor="rot">Un pensiero diverso ogni giorno</label></div>
        {!rotate && <>
          <label className="field"><span>La tua frase</span><textarea className="textarea" value={quote} onChange={(e) => setQuote(e.target.value)} rows={2} /></label>
          <label className="field"><span>Autore (facoltativo)</span><input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
        </>}
        <div className="field"><span>Colore principale (tema Rosa)</span><Swatches value={accent} onChange={setAccent} /></div>
      </div>
    </Modal>
  );
}
