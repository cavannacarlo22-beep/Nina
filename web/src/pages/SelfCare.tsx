import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Pause, Play, Shuffle, Wind } from 'lucide-react';
import { SELF_CARE, type SelfCareIdea } from '../content/seed';
import * as voce from '../content/voce';

const CATS: Record<string, { label: string; emoji: string }> = {
  RELAX: { label: 'Relax', emoji: '🛋️' }, CORPO: { label: 'Corpo', emoji: '🛁' }, MENTE: { label: 'Mente', emoji: '🧠' },
  CASA: { label: 'Casa', emoji: '🏡' }, FUORI: { label: 'Fuori', emoji: '🌳' }, CREATIVITA: { label: 'Creatività', emoji: '🎨' },
  SOCIAL: { label: 'Persone', emoji: '💌' }, DIGITALE: { label: 'Digitale', emoji: '📵' },
};

export function randomIdea(exclude?: SelfCareIdea, filter: (i: SelfCareIdea) => boolean = () => true): SelfCareIdea {
  const pool = SELF_CARE.filter((i) => i !== exclude && filter(i));
  return pool[Math.floor(Math.random() * pool.length)] ?? SELF_CARE[0];
}

export default function SelfCare() {
  const [cat, setCat] = useState<string>('');
  const [maxMin, setMaxMin] = useState(0);
  const filter = (i: SelfCareIdea) => (!cat || i.category === cat) && (!maxMin || i.minutes <= maxMin);
  const [idea, setIdea] = useState(() => randomIdea());
  const list = useMemo(() => SELF_CARE.filter(filter), [cat, maxMin]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="page">
      <div className="page-head"><div><h1>Self care</h1><p>{voce.inviteSelfCare()}</p></div></div>
      <div className="dash-grid" style={{ marginTop: 0 }}>
        <div className="span-7">
          <div className="hero" style={{ gridTemplateColumns: '1fr' }}>
            <div>
              <div className="small muted">{CATS[idea.category]?.emoji} {CATS[idea.category]?.label} · {idea.minutes} min</div>
              <h1 style={{ marginTop: 6 }}>{idea.title}</h1>
              <div className="quote" style={{ marginTop: 8 }}>{idea.description}</div>
              <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setIdea(randomIdea(idea, filter))}><Shuffle size={16} />Un’altra idea</button>
            </div>
          </div>
        </div>
        <div className="span-5"><Respira /></div>
        <div className="span-12 card">
          <div className="row wrap" style={{ marginBottom: 14 }}>
            <div className="chips grow">
              <button className={'chip' + (!cat ? ' active' : '')} onClick={() => setCat('')}>Tutte</button>
              {Object.entries(CATS).map(([k, v]) => <button key={k} className={'chip' + (cat === k ? ' active' : '')} onClick={() => setCat(k)}>{v.emoji} {v.label}</button>)}
            </div>
            <select className="select" style={{ width: 'auto' }} value={maxMin} onChange={(e) => setMaxMin(Number(e.target.value))}>
              <option value={0}>Qualsiasi durata</option><option value={5}>Fino a 5 min</option><option value={15}>Fino a 15 min</option><option value={30}>Fino a 30 min</option>
            </select>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {list.map((i) => (
              <button key={i.title} className="card hover" style={{ textAlign: 'left', background: 'var(--surface-2)', cursor: 'pointer' }} onClick={() => { setIdea(i); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <div className="row between tiny muted"><span>{CATS[i.category]?.emoji} {CATS[i.category]?.label}</span><span><Clock size={11} style={{ verticalAlign: -1 }} /> {i.minutes}′</span></div>
                <b style={{ display: 'block', marginTop: 6 }}>{i.title}</b>
                <span className="small muted">{i.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const PATTERNS = {
  quadrato: { label: 'Quadrato 4-4-4-4', steps: [['Inspira', 4], ['Trattieni', 4], ['Espira', 4], ['Trattieni', 4]] as [string, number][] },
  calma: { label: 'Calma 4-7-8', steps: [['Inspira', 4], ['Trattieni', 7], ['Espira', 8]] as [string, number][] },
  semplice: { label: 'Semplice 4-6', steps: [['Inspira', 4], ['Espira', 6]] as [string, number][] },
};

/** Un esercizio di respirazione guidato: il cerchio cresce quando inspiri. */
export function Respira() {
  const [pattern, setPattern] = useState<keyof typeof PATTERNS>('quadrato');
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [left, setLeft] = useState(0);
  const [cycles, setCycles] = useState(0);
  const timer = useRef<number | null>(null);
  const steps = PATTERNS[pattern].steps;

  useEffect(() => {
    if (!running) return;
    setLeft(steps[step][1]);
    timer.current = window.setInterval(() => {
      setLeft((l) => {
        if (l > 1) return l - 1;
        setStep((s) => {
          const n = (s + 1) % steps.length;
          if (n === 0) setCycles((c) => c + 1);
          return n;
        });
        return 0;
      });
    }, 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [running, step, pattern]); // eslint-disable-line react-hooks/exhaustive-deps

  const [label, secs] = steps[step];
  const big = label === 'Inspira' || (label === 'Trattieni' && steps[(step - 1 + steps.length) % steps.length][0] === 'Inspira');
  return (
    <div className="card" style={{ height: '100%', textAlign: 'center' }}>
      <div className="card-head"><h3><Wind size={18} />Respira</h3><span className="small muted">{cycles ? `${cycles} ${cycles === 1 ? 'giro' : 'giri'}` : ''}</span></div>
      <div style={{ height: 200, display: 'grid', placeItems: 'center' }}>
        <div style={{
          width: running ? (big ? 180 : 90) : 120, height: running ? (big ? 180 : 90) : 120, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, var(--blue-soft), var(--primary-soft) 60%, var(--lilac-soft))',
          boxShadow: '0 0 0 10px color-mix(in srgb, var(--primary-soft) 40%, transparent)',
          transition: `width ${secs}s ease-in-out, height ${secs}s ease-in-out`, display: 'grid', placeItems: 'center',
        }}>
          <div><b style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>{running ? label : 'Pronta?'}</b>{running && <div className="small muted">{left}</div>}</div>
        </div>
      </div>
      <div className="chips" style={{ justifyContent: 'center', marginBottom: 12 }}>
        {(Object.keys(PATTERNS) as (keyof typeof PATTERNS)[]).map((k) => (
          <button key={k} className={'chip' + (pattern === k ? ' active' : '')} onClick={() => { setPattern(k); setStep(0); setCycles(0); }}>{PATTERNS[k].label}</button>
        ))}
      </div>
      <button className="btn btn-primary" onClick={() => { setRunning(!running); setStep(0); }}>{running ? <><Pause size={16} />Basta così</> : <><Play size={16} />Inizia</>}</button>
    </div>
  );
}
