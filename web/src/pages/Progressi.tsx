import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookHeart, CheckCircle2, Droplet, Flame, Heart, Timer, TrendingUp } from 'lucide-react';
import { db } from '../db/db';
import { addDays, fromISO, toISO, todayISO } from '../lib/dates';
import { categoryInfo } from '../lib/tasks';
import { bestStreak, currentStreak, moodInfo, MOODS } from '../lib/wellbeing';
import * as voce from '../content/voce';

type Period = 'week' | 'month' | 'year';
const DAYS: Record<Period, number> = { week: 7, month: 30, year: 365 };

export default function Progressi() {
  const [period, setPeriod] = useState<Period>('month');
  const data = useLiveQuery(async () => {
    const to = todayISO();
    const from = toISO(addDays(new Date(), -(DAYS[period] - 1)));
    const inRange = (d: string | null | undefined) => !!d && d >= from && d <= to;
    const tasks = (await db.tasks.toArray()).filter((t) => inRange(t.date) || (t.completedAt && inRange(t.completedAt.slice(0, 10))));
    const completed = tasks.filter((t) => t.isCompleted);
    const byCat = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      const c = byCat.get(t.category) ?? { total: 0, done: 0 };
      c.total++;
      if (t.isCompleted) c.done++;
      byCat.set(t.category, c);
    }
    const habits = await db.habits.toArray();
    const comps = await db.habitCompletions.toArray();
    const habitStats = habits.map((h) => {
      const done = new Set(comps.filter((c) => c.habitId === h.id && c.completed).map((c) => c.date));
      return { h, inPeriod: [...done].filter(inRange).length, streak: currentStreak(h, done), best: bestStreak(h, done) };
    }).sort((a, b) => b.best - a.best);
    const moods = (await db.moods.toArray()).filter((m) => inRange(m.date));
    const focus = (await db.focus.toArray()).filter((f) => inRange(f.date));
    const diary = (await db.diaryEntries.toArray()).filter((d) => inRange(d.entryDate)).length;
    const logs = (await db.dayLogs.toArray()).filter((l) => inRange(l.date));
    const water = logs.filter((l) => l.water).reduce((a, l, _i, arr) => a + l.water / arr.length, 0);
    // completate per giorno (ultime 14 colonne, raggruppate se il periodo è lungo)
    const buckets = period === 'week' ? 7 : period === 'month' ? 10 : 12;
    const span = DAYS[period] / buckets;
    const perBucket = Array.from({ length: buckets }, (_, i) => {
      const a = toISO(addDays(fromISO(from), Math.floor(i * span)));
      const b = toISO(addDays(fromISO(from), Math.floor((i + 1) * span) - 1));
      return { a, b, n: completed.filter((t) => { const d = (t.completedAt ?? '').slice(0, 10); return d >= a && d <= b; }).length };
    });
    return { tasks, completed, byCat, habitStats, moods, focus, diary, water, perBucket };
  }, [period]);
  if (!data) return null;
  const rate = data.tasks.length ? Math.round((data.completed.length / data.tasks.length) * 100) : 0;
  const focusMin = data.focus.reduce((a, f) => a + f.minutes, 0);
  const moodCounts = MOODS.map((m) => ({ ...m, n: data.moods.filter((x) => x.mood === m.id).length }));
  const topMood = [...moodCounts].sort((a, b) => b.n - a.n)[0];
  const maxBucket = Math.max(1, ...data.perBucket.map((b) => b.n));

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Progressi</h1><p>Quello che hai fatto, senza classifiche. {voce.incoraggiamento()}</p></div>
        <div className="seg">
          {(['week', 'month', 'year'] as Period[]).map((p) => <button key={p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>{{ week: 'Settimana', month: 'Mese', year: 'Anno' }[p]}</button>)}
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: 18 }}>
        <Stat icon={<CheckCircle2 size={20} />} value={data.completed.length} label={`cose fatte · ${rate}%`} color="#e46f8e" />
        <Stat icon={<Flame size={20} />} value={data.habitStats.reduce((a, h) => a + h.inPeriod, 0)} label="volte abitudini" color="#f2a35e" />
        <Stat icon={<Timer size={20} />} value={focusMin >= 60 ? `${Math.floor(focusMin / 60)}h ${focusMin % 60}′` : `${focusMin}′`} label="di studio concentrato" color="#bfa8e8" />
        <Stat icon={<Heart size={20} />} value={topMood?.n ? topMood.emoji : '—'} label={topMood?.n ? `umore più frequente: ${topMood.label.toLowerCase()}` : 'umore non registrato'} color="#f39cc0" />
        <Stat icon={<BookHeart size={20} />} value={data.diary} label="pagine di diario" color="#7fbfe8" />
        <Stat icon={<Droplet size={20} />} value={data.water ? data.water.toFixed(1).replace('.', ',') : '—'} label="bicchieri d’acqua al giorno" color="#5fa8dc" />
      </div>
      <div className="dash-grid" style={{ marginTop: 0 }}>
        <div className="span-7 card">
          <div className="card-head"><h3><TrendingUp size={18} />Cose fatte nel tempo</h3></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
            {data.perBucket.map((b) => (
              <div key={b.a} style={{ flex: 1, textAlign: 'center' }} title={`${b.n} cose fatte`}>
                <div className="tiny muted">{b.n || ''}</div>
                <div style={{ height: Math.max(4, (b.n / maxBucket) * 120), background: 'linear-gradient(180deg, var(--primary), var(--lilac))', borderRadius: 8 }} />
                <div className="tiny muted" style={{ marginTop: 4 }}>{period === 'year' ? fromISO(b.a).toLocaleDateString('it-IT', { month: 'narrow' }) : fromISO(b.a).getDate()}</div>
              </div>
            ))}
          </div>
          <div className="divider" />
          {[...data.byCat.entries()].sort((a, b) => b[1].total - a[1].total).map(([c, v]) => {
            const info = categoryInfo(c as never);
            return (
              <div key={c} className="row small" style={{ marginBottom: 6 }}>
                <span style={{ width: 110 }}>{info.emoji} {info.label}</span>
                <div className="grow"><div className="progress" style={{ height: 8 }}><div style={{ width: `${(v.done / v.total) * 100}%`, background: info.color }} /></div></div>
                <span className="muted" style={{ width: 50, textAlign: 'right' }}>{v.done}/{v.total}</span>
              </div>
            );
          })}
          {data.byCat.size === 0 && <p className="small muted">Nessuna attività con una data in questo periodo.</p>}
        </div>
        <div className="span-5 card">
          <div className="card-head"><h3><Flame size={18} />Abitudini</h3></div>
          {data.habitStats.length === 0 && <p className="small muted">{voce.nienteAbitudini()}</p>}
          {data.habitStats.map(({ h, inPeriod, streak, best }) => (
            <div key={h.id} className="list-row">
              <span style={{ fontSize: '1.3rem' }}>{h.icon}</span>
              <div className="grow"><b className="small">{h.name}</b><div className="tiny muted">{inPeriod} volte · record {best} giorni</div></div>
              <span className="badge" style={{ background: streak ? '#f2a35e' : 'var(--surface-3)', color: streak ? '#fff' : 'var(--muted)' }}>🔥 {streak}</span>
            </div>
          ))}
          <div className="divider" />
          <div className="card-head" style={{ marginBottom: 8 }}><h3><Heart size={18} />Umore</h3></div>
          <div className="row" style={{ gap: 2, flexWrap: 'wrap' }}>
            {data.moods.sort((a, b) => a.date.localeCompare(b.date)).slice(-40).map((m) => <span key={m.id} title={m.date} style={{ fontSize: '1.15rem' }}>{moodInfo(m.mood)?.emoji}</span>)}
            {data.moods.length === 0 && <span className="small muted">Segna come ti senti dalla Home o da “Umore e diario”.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, value, label, color }: { icon: React.ReactNode; value: React.ReactNode; label: string; color: string }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <span className="list-emoji" style={{ background: color + '22', color }}>{icon}</span>
      <div className="stat"><b>{value}</b><span>{label}</span></div>
    </div>
  );
}
