import { useMemo, useState } from 'react';
import { Heart, Maximize2, Quote as QuoteIcon, Search, Shuffle, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { QUOTES, type Quote } from '../content/seed';
import { pensieroDelGiorno } from '../content/voce';
import { setSettings, useSettings } from '../db/settings';

const keyOf = (q: Quote) => q.text;

export function useFavoriteQuotes() {
  const s = useSettings();
  const fav = new Set(s.favoriteQuotes);
  const toggle = (q: Quote) => setSettings({ favoriteQuotes: fav.has(keyOf(q)) ? s.favoriteQuotes.filter((x) => x !== keyOf(q)) : [...s.favoriteQuotes, keyOf(q)] });
  return { fav, toggle };
}

function randomQuote(exclude?: Quote): Quote {
  const pool = QUOTES.filter((q) => q !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Il pensiero di oggi, come nell'app iOS: grande, con il cuore e "un'altra frase". */
export function PensieroCard() {
  const { fav, toggle } = useFavoriteQuotes();
  const [q, setQ] = useState<Quote>(() => pensieroDelGiorno());
  const [full, setFull] = useState(false);
  const isFav = fav.has(keyOf(q));
  return (
    <div className="card" style={{ height: '100%', background: 'linear-gradient(135deg, var(--primary-soft), var(--surface) 60%, var(--blue-soft))', position: 'relative', overflow: 'hidden' }}>
      <div className="label" style={{ textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--primary-strong)' }}>Pensiero di oggi</div>
      <div style={{ position: 'absolute', right: 14, top: -10, fontFamily: 'Georgia, serif', fontSize: 120, color: 'var(--primary)', opacity: 0.12, lineHeight: 1 }}>“</div>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.2rem, 2vw, 1.5rem)', lineHeight: 1.35, margin: '12px 0 6px' }}>{q.text}</p>
      {q.author && <div className="small muted">— {q.author}</div>}
      <div className="row" style={{ marginTop: 14 }}>
        <button className={'btn btn-sm ' + (isFav ? 'btn-primary' : 'btn-soft')} onClick={() => toggle(q)}><Heart size={15} fill={isFav ? 'currentColor' : 'none'} />{isFav ? 'Tra i preferiti' : 'Mi piace'}</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setQ(randomQuote(q))}><Shuffle size={15} />Un’altra</button>
        <span className="grow" />
        <button className="icon-btn sm" onClick={() => setFull(true)} aria-label="Schermo intero"><Maximize2 size={16} /></button>
      </div>
      {full && <PensieroSchermoIntero q={q} onClose={() => setFull(false)} onNext={() => setQ(randomQuote(q))} />}
    </div>
  );
}

function PensieroSchermoIntero({ q, onClose, onNext }: { q: Quote; onClose: () => void; onNext: () => void }) {
  const { fav, toggle } = useFavoriteQuotes();
  const isFav = fav.has(keyOf(q));
  return createPortal(
    <div className="overlay" style={{ background: 'linear-gradient(140deg, var(--primary-soft), var(--bg) 50%, var(--blue-soft))', backdropFilter: 'none' }} onClick={onClose}>
      <div style={{ maxWidth: 720, textAlign: 'center', padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <QuoteIcon size={40} color="var(--primary)" />
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.6rem)', lineHeight: 1.3, margin: '18px 0' }}>{q.text}</p>
        {q.author && <div className="muted">— {q.author}</div>}
        <div className="row" style={{ justifyContent: 'center', marginTop: 28 }}>
          <button className={'btn ' + (isFav ? 'btn-primary' : 'btn-soft')} onClick={() => toggle(q)}><Heart size={16} fill={isFav ? 'currentColor' : 'none'} />{isFav ? 'Tra i preferiti' : 'Mi piace'}</button>
          <button className="btn" onClick={onNext}><Shuffle size={16} />Un’altra</button>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} />Chiudi</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function Pensieri() {
  const { fav, toggle } = useFavoriteQuotes();
  const [onlyFav, setOnlyFav] = useState(false);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return QUOTES.filter((x) => (!onlyFav || fav.has(keyOf(x))) && (!n || x.text.toLowerCase().includes(n) || (x.author ?? '').toLowerCase().includes(n)));
  }, [q, onlyFav, fav]);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Pensieri</h1><p>Le frasi di Nina e di chi è venuto prima di noi. Tieni quelle che ti fanno bene.</p></div>
        <div className="seg"><button className={!onlyFav ? 'active' : ''} onClick={() => setOnlyFav(false)}>Tutti ({QUOTES.length})</button><button className={onlyFav ? 'active' : ''} onClick={() => setOnlyFav(true)}><Heart size={13} style={{ verticalAlign: -2 }} /> Preferiti ({fav.size})</button></div>
      </div>
      <div className="dash-grid" style={{ marginTop: 0, marginBottom: 18 }}><div className="span-12"><PensieroCard /></div></div>
      <div className="search" style={{ marginBottom: 14 }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca una parola o un autore" /></div>
      {list.length === 0 && <p className="muted">{onlyFav ? 'Tocca il cuore su una frase per tenerla qui.' : 'Nessuna frase trovata.'}</p>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {list.map((x) => {
          const f = fav.has(keyOf(x));
          return (
            <div key={x.text} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.08rem', margin: 0, lineHeight: 1.4, flex: 1 }}>“{x.text}”</p>
              <div className="row between">
                <span className="small muted">{x.author ? `— ${x.author}` : 'Nina'}</span>
                <button className="icon-btn sm" onClick={() => toggle(x)} aria-label={f ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}><Heart size={17} fill={f ? 'var(--primary)' : 'none'} color="var(--primary)" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
