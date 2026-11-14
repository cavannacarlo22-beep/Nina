import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Droplet, Flower2, GlassWater, Moon, Plus, Sparkles } from 'lucide-react';
import { db } from '../db/db';
import { setSettings, useSettings } from '../db/settings';
import { addDays, addMonths, fmtMonth, fromISO, monthMatrix, toISO, todayISO, weekdayNames } from '../lib/dates';
import { cycleInfo, emptyDay, getDay, patchDay } from '../lib/wellbeing';

export default function Benessere() {
  const [date, setDate] = useState(todayISO());
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Benessere</h1><p>Acqua, sonno, ciclo e le piccole cose belle di ogni giorno.</p></div>
        <div className="row">
          <button className="icon-btn" onClick={() => setDate(toISO(addDays(fromISO(date), -1)))} aria-label="Giorno precedente"><ChevronLeft /></button>
          <input className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 'auto' }} />
          <button className="icon-btn" onClick={() => setDate(toISO(addDays(fromISO(date), 1)))} aria-label="Giorno successivo"><ChevronRight /></button>
        </div>
      </div>
      <div className="dash-grid" style={{ marginTop: 0 }}>
        <div className="span-6"><Day date={date} /></div>
        <div className="span-6"><Cycle /></div>
        <div className="span-12"><Week /></div>
      </div>
    </div>
  );
}

export function WaterTracker({ date, goal, size = 30 }: { date: string; goal: number; size?: number }) {
  const log = useLiveQuery(() => getDay(date), [date]) ?? emptyDay(date);
  return (
    <div className="water">
      {Array.from({ length: Math.max(goal, log.water) }, (_, i) => (
        <button key={i} className={i < log.water ? 'on' : ''} onClick={() => patchDay(date, { water: i + 1 === log.water ? i : i + 1 })} aria-label={`${i + 1} bicchieri`}>
          <Droplet size={size} fill={i < log.water ? 'currentColor' : 'none'} />
        </button>
      ))}
      <button onClick={() => patchDay(date, { water: log.water + 1 })} aria-label="Un bicchiere in più" style={{ color: 'var(--muted)' }}><Plus size={size * 0.7} /></button>
    </div>
  );
}

function Day({ date }: { date: string }) {
  const s = useSettings();
  const log = useLiveQuery(() => getDay(date), [date]) ?? emptyDay(date);
  const [grat, setGrat] = useState(log.gratitude);
  useEffect(() => { setGrat(log.gratitude); }, [date, log.gratitude]);
  useEffect(() => {
    if (grat === log.gratitude) return;
    const t = setTimeout(() => void patchDay(date, { gratitude: grat }), 500);
    return () => clearTimeout(t);
  }, [grat]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head"><h3><Sparkles size={18} />{date === todayISO() ? 'Oggi' : fromISO(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</h3></div>
      <div className="label" style={{ marginBottom: 6 }}><GlassWater size={14} style={{ verticalAlign: -2 }} /> Acqua · {log.water}/{s.waterGoal} bicchieri</div>
      <WaterTracker date={date} goal={s.waterGoal} />
      <label className="row small" style={{ marginTop: 6 }}>Obiettivo <input className="input" type="number" min={1} max={20} value={s.waterGoal} onChange={(e) => setSettings({ waterGoal: Math.max(1, Number(e.target.value) || 8) })} style={{ width: 70, minHeight: 34 }} /></label>
      <div className="label" style={{ margin: '16px 0 6px' }}><Moon size={14} style={{ verticalAlign: -2 }} /> Ore di sonno</div>
      <div className="row"><input type="range" min={0} max={12} step={0.5} value={log.sleep} onChange={(e) => patchDay(date, { sleep: Number(e.target.value) })} className="grow" /><b>{String(log.sleep).replace('.', ',')} h</b></div>
      <label className="field" style={{ marginTop: 16 }}><span><Sparkles size={13} style={{ verticalAlign: -2 }} /> Tre cose belle di oggi</span>
        <textarea className="textarea" value={grat} onChange={(e) => setGrat(e.target.value)} rows={3} placeholder="Anche minuscole. Soprattutto minuscole." />
      </label>
    </div>
  );
}

function Cycle() {
  const [cursor, setCursor] = useState(new Date());
  const logs = useLiveQuery(() => db.dayLogs.filter((l) => l.period).toArray(), []) ?? [];
  const period = new Set(logs.map((l) => l.date));
  const info = useMemo(() => cycleInfo([...period]), [logs]); // eslint-disable-line react-hooks/exhaustive-deps
  const predicted = new Set<string>();
  const fertile = new Set<string>();
  if (info.next) {
    for (let k = 0; k < 3; k++) {
      const start = addDays(fromISO(info.next), info.avg * k);
      for (let i = 0; i < 5; i++) predicted.add(toISO(addDays(start, i)));
      const ov = addDays(start, -14);
      for (let i = -4; i <= 1; i++) fertile.add(toISO(addDays(ov, i)));
    }
  }
  const days = monthMatrix(cursor);
  const today = todayISO();
  const daysTo = info.next ? Math.round((fromISO(info.next).getTime() - fromISO(today).getTime()) / 86400000) : null;
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head">
        <h3><Flower2 size={18} />Ciclo</h3>
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
          const cls = [period.has(iso) ? 'period' : predicted.has(iso) ? 'predicted' : fertile.has(iso) ? 'fertile' : '', iso === today ? 'today' : ''].join(' ');
          return <button key={iso} className={cls} style={{ opacity: d.getMonth() === cursor.getMonth() ? 1 : 0.35 }} onClick={() => patchDay(iso, { period: !period.has(iso) })}>{d.getDate()}</button>;
        })}
      </div>
      <div className="row wrap small" style={{ gap: 14, marginTop: 12 }}>
        <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--primary)' }} />Mestruazioni</span>
        <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--primary-soft)' }} />Previste</span>
        <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--blue-soft)' }} />Finestra fertile stimata</span>
      </div>
      <div className="divider" />
      {info.last ? (
        <p className="small" style={{ margin: 0 }}>
          Durata media: <b>{info.avg} giorni</b>{!info.measured && ' (stima: segna almeno due cicli per un calcolo personale)'}.<br />
          {daysTo !== null && (daysTo > 0 ? <>Prossimo previsto tra <b>{daysTo} giorni</b> ({fromISO(info.next!).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}).</> : daysTo === 0 ? <>Previsto <b>oggi</b>.</> : <>In ritardo di {-daysTo} giorni rispetto alla stima.</>)}
        </p>
      ) : <p className="small muted" style={{ margin: 0 }}>Tocca i giorni del ciclo per segnarli: Nina stimerà il prossimo.</p>}
      <p className="tiny muted" style={{ marginBottom: 0 }}>Le previsioni sono indicative e non sostituiscono il parere medico né un metodo contraccettivo.</p>
    </div>
  );
}

function Week() {
  const s = useSettings();
  const days = Array.from({ length: 7 }, (_, i) => toISO(addDays(new Date(), i - 6)));
  const logs = useLiveQuery(() => db.dayLogs.where('date').anyOf(days).toArray(), []) ?? [];
  const by = new Map<string, { water: number; sleep: number }>();
  for (const l of logs) by.set(l.date, { water: Math.max(by.get(l.date)?.water ?? 0, l.water), sleep: Math.max(by.get(l.date)?.sleep ?? 0, l.sleep) });
  const avgSleep = logs.filter((l) => l.sleep).reduce((a, l, _i, arr) => a + l.sleep / arr.length, 0);
  return (
    <div className="card">
      <div className="card-head"><h3>Ultimi 7 giorni</h3><span className="small muted">sonno medio {avgSleep ? avgSleep.toFixed(1).replace('.', ',') + ' h' : '—'}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, alignItems: 'end', height: 130 }}>
        {days.map((d) => {
          const v = by.get(d);
          return (
            <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 90 }}>
                <div title={`${v?.water ?? 0} bicchieri`} style={{ width: 12, borderRadius: 6, background: 'var(--blue)', height: Math.max(3, ((v?.water ?? 0) / Math.max(s.waterGoal, 1)) * 80) }} />
                <div title={`${v?.sleep ?? 0} ore`} style={{ width: 12, borderRadius: 6, background: 'var(--lilac)', height: Math.max(3, ((v?.sleep ?? 0) / 10) * 80) }} />
              </div>
              <span className="tiny muted">{fromISO(d).toLocaleDateString('it-IT', { weekday: 'narrow' })}</span>
            </div>
          );
        })}
      </div>
      <div className="row small" style={{ gap: 14, marginTop: 8 }}>
        <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--blue)' }} />Acqua</span>
        <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--lilac)' }} />Sonno</span>
      </div>
    </div>
  );
}
