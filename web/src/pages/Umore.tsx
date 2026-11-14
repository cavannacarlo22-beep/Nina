import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookLock, ChevronLeft, ChevronRight, Heart, Lock, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { db, uid } from '../db/db';
import type { DiaryEntry, MoodKind } from '../db/types';
import { addMonths, fmtMonth, fromISO, monthMatrix, toISO, todayISO, weekdayNames } from '../lib/dates';
import { isPositive, moodInfo, MOODS, setMood } from '../lib/wellbeing';
import * as voce from '../content/voce';
import { Empty, Modal, useUI } from '../components/ui';

export function MoodPicker({ date, compact }: { date: string; compact?: boolean }) {
  const ui = useUI();
  const mood = useLiveQuery(() => db.moods.where('date').equals(date).first(), [date]);
  const [reply, setReply] = useState('');
  const pick = async (m: MoodKind) => {
    const same = mood?.mood === m;
    await setMood(date, same ? null : m);
    setReply(same ? '' : isPositive(m) ? voce.moodPositivo() : m === 'COSI_COSI' ? 'Segnato 💗 Domani magari va meglio.' : voce.moodDifficile());
  };
  void ui;
  return (
    <>
    <div className="mood-row" style={{ flexWrap: 'wrap' }}>
      {MOODS.map((m) => (
        <button key={m.id} className={'mood-btn' + (mood?.mood === m.id ? ' active' : '')} onClick={() => pick(m.id)} title={m.label}
          style={compact ? { width: 44, height: 44, fontSize: '1.3rem' } : { width: 64, height: 70, flexDirection: 'column', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <span>{m.emoji}</span>{!compact && <span className="tiny" style={{ fontSize: '.66rem' }}>{m.label}</span>}
        </button>
      ))}
    </div>
    {reply && <p className="small" style={{ margin: '10px 0 0', color: 'var(--primary-strong)', fontWeight: 600 }}>{reply}</p>}
    </>
  );
}

export default function Umore() {
  const [date, setDate] = useState(todayISO());
  const [cursor, setCursor] = useState(new Date());
  const mood = useLiveQuery(() => db.moods.where('date').equals(date).first(), [date]);
  const [note, setNote] = useState('');
  useEffect(() => setNote(mood?.note ?? ''), [mood?.id, mood?.note]);

  const days = monthMatrix(cursor);
  const monthMoods = useLiveQuery(() => db.moods.where('date').between(toISO(days[0]), toISO(days[41]), true, true).toArray(), [cursor.getMonth(), cursor.getFullYear()]) ?? [];
  const map = new Map(monthMoods.map((m) => [m.date, m]));
  const inMonth = monthMoods.filter((m) => fromISO(m.date).getMonth() === cursor.getMonth());
  const counts = MOODS.map((m) => ({ ...m, n: inMonth.filter((x) => x.mood === m.id).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));

  return (
    <div className="page">
      <div className="page-head"><div><h1>Umore e diario</h1><p>Un tocco al giorno e, col tempo, l’andamento. Il diario è solo tuo.</p></div></div>
      <div className="dash-grid" style={{ marginTop: 0 }}>
        <div className="span-6 card">
          <div className="card-head">
            <h3><Heart size={18} />{date === todayISO() ? 'Come ti senti oggi?' : fromISO(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 'auto', minHeight: 36 }} />
          </div>
          <MoodPicker date={date} />
          {mood && (
            <label className="field" style={{ marginTop: 14 }}><span>Vuoi aggiungere due parole?</span>
              <textarea className="textarea" rows={2} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)}
                onBlur={() => note !== (mood.note ?? '') && setMood(date, mood.mood, note.trim() || null)} placeholder="Perché oggi è così?" />
            </label>
          )}
        </div>
        <div className="span-6 card">
          <div className="card-head">
            <h3>Il tuo mese</h3>
            <div className="row" style={{ gap: 2 }}>
              <button className="icon-btn sm" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Mese precedente"><ChevronLeft size={16} /></button>
              <b className="small" style={{ textTransform: 'capitalize', minWidth: 110, textAlign: 'center' }}>{fmtMonth(cursor)}</b>
              <button className="icon-btn sm" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Mese successivo"><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="cycle-cal">
            {weekdayNames(true, 'narrow').map((w, i) => <div key={i} className="tiny muted" style={{ textAlign: 'center' }}>{w}</div>)}
            {days.map((d) => {
              const iso = toISO(d);
              const m = map.get(iso);
              return (
                <button key={iso} onClick={() => iso <= todayISO() && setDate(iso)} title={m?.note ?? undefined}
                  style={{ opacity: d.getMonth() === cursor.getMonth() ? 1 : 0.3, fontSize: m ? '1.25rem' : '.8rem', color: 'var(--muted)', background: iso === date ? 'var(--primary-soft)' : 'none' }}>
                  {m ? moodInfo(m.mood)?.emoji : d.getDate()}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14 }}>
            {counts.map((c) => (
              <div key={c.id} className="row small" style={{ gap: 8, marginBottom: 4 }}>
                <span style={{ width: 22 }}>{c.emoji}</span>
                <span style={{ width: 78 }}>{c.label}</span>
                <div className="grow"><div className="progress" style={{ height: 8 }}><div style={{ width: `${(c.n / max) * 100}%`, background: c.color }} /></div></div>
                <b style={{ width: 20, textAlign: 'right' }}>{c.n}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="span-12"><Diario /></div>
      </div>
    </div>
  );
}

function Diario() {
  const ui = useUI();
  const entries = useLiveQuery(() => db.diaryEntries.orderBy('entryDate').reverse().toArray(), []) ?? [];
  const [edit, setEdit] = useState<DiaryEntry | null>(null);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? entries.filter((e) => (e.title ?? '').toLowerCase().includes(n) || e.content.toLowerCase().includes(n)) : entries;
  }, [entries, q]);
  const blank = (): DiaryEntry => ({ id: '', title: null, content: '', mood: null, entryDate: todayISO(), createdAt: new Date().toISOString() });
  return (
    <div className="card">
      <div className="card-head">
        <h3><BookLock size={18} />Diario</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setEdit(blank())}><Plus size={15} />Scrivi</button>
      </div>
      <p className="small muted" style={{ marginTop: -6 }}><Lock size={12} style={{ verticalAlign: -1 }} /> {voce.nienteDiario()}</p>
      {entries.length > 4 && <div className="search" style={{ marginBottom: 12 }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nel diario" /></div>}
      {shown.length === 0 ? <Empty title="Nessuna pagina ancora" text="Scrivi com’è andata, cosa ti gira in testa, una cosa bella di oggi." /> : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {shown.map((e) => (
            <button key={e.id} className="card hover" style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--surface-2)' }} onClick={() => setEdit(e)}>
              <div className="row between small muted">
                <span style={{ textTransform: 'capitalize' }}>{fromISO(e.entryDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                <span style={{ fontSize: '1.2rem' }}>{moodInfo(e.mood)?.emoji}</span>
              </div>
              {e.title && <b style={{ display: 'block', marginTop: 6, fontFamily: 'var(--font-display)' }}>{e.title}</b>}
              <p className="small" style={{ margin: '6px 0 0', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--text-2)' }}>{e.content}</p>
            </button>
          ))}
        </div>
      )}
      {edit && <DiaryEditor entry={edit} onClose={() => setEdit(null)} onDelete={async () => {
        if (await ui.confirm({ title: 'Eliminare questa pagina?', ok: 'Elimina', danger: true })) { await db.diaryEntries.delete(edit.id); setEdit(null); }
      }} />}
    </div>
  );
}

function DiaryEditor({ entry, onClose, onDelete }: { entry: DiaryEntry; onClose: () => void; onDelete: () => void }) {
  const ui = useUI();
  const [e, setE] = useState(entry);
  const save = async () => {
    if (!e.content.trim()) { ui.toast('Scrivi qualcosa, anche poco 💗', true); return; }
    await db.diaryEntries.put({ ...e, id: e.id || uid(), title: e.title?.trim() || null, content: e.content.slice(0, 50000) });
    onClose();
  };
  return (
    <Modal title={entry.id ? 'Pagina di diario' : 'Nuova pagina'} size="wide" icon={<Pencil size={20} color="var(--primary)" />} onClose={onClose} footer={<>
      {entry.id && <button className="btn btn-danger" onClick={onDelete}><Trash2 size={16} />Elimina</button>}
      <span className="grow" />
      <button className="btn" onClick={onClose}>Annulla</button>
      <button className="btn btn-primary" onClick={save}>Salva</button>
    </>}>
      <div className="stack">
        <div className="row wrap">
          <input className="input" type="date" value={e.entryDate} onChange={(x) => x.target.value && setE({ ...e, entryDate: x.target.value })} style={{ width: 'auto' }} />
          <div className="chips">
            {MOODS.map((m) => <button key={m.id} className={'chip' + (e.mood === m.id ? ' active' : '')} onClick={() => setE({ ...e, mood: e.mood === m.id ? null : m.id })} title={m.label}>{m.emoji}</button>)}
          </div>
        </div>
        <input className="input" value={e.title ?? ''} maxLength={200} onChange={(x) => setE({ ...e, title: x.target.value })} placeholder="Titolo (facoltativo)" />
        <textarea className="textarea" autoFocus value={e.content} onChange={(x) => setE({ ...e, content: x.target.value })} rows={12} placeholder="Caro diario…"
          style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', lineHeight: 1.7 }} />
      </div>
    </Modal>
  );
}
