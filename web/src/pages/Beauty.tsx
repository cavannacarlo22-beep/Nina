import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Camera, Heart, ImagePlus, Moon, Plus, Search, Sparkles, Star, Sun, Trash2, X } from 'lucide-react';
import { db, uid } from '../db/db';
import type { BeautyCategory, BeautyProduct, Look, RoutineStep } from '../db/types';
import { compressImage, pickFiles } from '../lib/files';
import { fromISO, todayISO } from '../lib/dates';
import { BEAUTY_CATS, beautyCat, expiryState, PAO_SUGGEST, SWATCHES } from '../lib/beauty';
import { emptyDay, getDay, patchDay } from '../lib/wellbeing';
import { Empty, Modal, Swatches, Switch, useUI } from '../components/ui';
import { blankWish } from './Wishlist';

type Tab = 'trousse' | 'look' | 'routine';

export default function Beauty() {
  const [tab, setTab] = useState<Tab>('trousse');
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Beauty</h1><p>La tua trousse con le scadenze sotto controllo, i look che ami e la routine di ogni giorno.</p></div>
        <div className="seg">
          <button className={tab === 'trousse' ? 'active' : ''} onClick={() => setTab('trousse')}>💄 Trousse</button>
          <button className={tab === 'look' ? 'active' : ''} onClick={() => setTab('look')}>✨ Look</button>
          <button className={tab === 'routine' ? 'active' : ''} onClick={() => setTab('routine')}>🧖‍♀️ Routine</button>
        </div>
      </div>
      {tab === 'trousse' && <Trousse />}
      {tab === 'look' && <Looks />}
      {tab === 'routine' && <Routine />}
    </div>
  );
}

/* ———————————— Trousse ———————————— */

export function blankProduct(p: Partial<BeautyProduct> = {}): BeautyProduct {
  return { id: '', name: '', brand: '', category: 'viso', shade: '', swatch: '', openedAt: '', paoMonths: null, expiresAt: '', price: null, rating: 0, favorite: false, finished: false, notes: '', image: '', createdAt: Date.now(), ...p };
}

function Trousse() {
  const products = useLiveQuery(() => db.beauty.toArray(), []) ?? [];
  const [cat, setCat] = useState<BeautyCategory | '' | 'fav' | 'scadenza'>('');
  const [q, setQ] = useState('');
  const [showFinished, setShowFinished] = useState(false);
  const [edit, setEdit] = useState<BeautyProduct | null>(null);
  const expiring = products.filter((p) => !p.finished && ['presto', 'scaduto'].includes(expiryState(p).state));
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return products
      .filter((p) => p.finished === showFinished)
      .filter((p) => !cat || (cat === 'fav' ? p.favorite : cat === 'scadenza' ? ['presto', 'scaduto'].includes(expiryState(p).state) : p.category === cat))
      .filter((p) => !n || `${p.name} ${p.brand} ${p.shade}`.toLowerCase().includes(n))
      .sort((a, b) => (expiryState(a).days ?? 9999) - (expiryState(b).days ?? 9999));
  }, [products, cat, q, showFinished]);
  const value = products.filter((p) => !p.finished && p.price).reduce((s, p) => s + (p.price ?? 0), 0);

  return (
    <>
      {expiring.length > 0 && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          <AlertTriangle size={18} />
          <span><b>{expiring.length} {expiring.length === 1 ? 'prodotto' : 'prodotti'}</b> {expiring.length === 1 ? 'è scaduto o scade' : 'sono scaduti o scadono'} entro un mese: {expiring.slice(0, 4).map((p) => p.name).join(', ')}{expiring.length > 4 ? '…' : ''}. Truccarsi con prodotti scaduti può irritare la pelle e gli occhi.</span>
        </div>
      )}
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <div className="search grow" style={{ minWidth: 200 }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per nome, marca o colore" /></div>
        <div className="seg"><button className={!showFinished ? 'active' : ''} onClick={() => setShowFinished(false)}>In uso</button><button className={showFinished ? 'active' : ''} onClick={() => setShowFinished(true)}>Finiti</button></div>
        <button className="btn btn-primary" onClick={() => setEdit(blankProduct({ category: cat && cat !== 'fav' && cat !== 'scadenza' ? cat : 'viso', openedAt: todayISO() }))}><Plus size={18} />Prodotto</button>
      </div>
      <div className="chips scroll" style={{ marginBottom: 16 }}>
        <button className={'chip' + (!cat ? ' active' : '')} onClick={() => setCat('')}>Tutti ({products.filter((p) => !p.finished).length})</button>
        <button className={'chip' + (cat === 'fav' ? ' active' : '')} onClick={() => setCat('fav')}><Heart size={13} />Preferiti</button>
        <button className={'chip' + (cat === 'scadenza' ? ' active' : '')} onClick={() => setCat('scadenza')}><AlertTriangle size={13} />In scadenza</button>
        {BEAUTY_CATS.map((c) => <button key={c.id} className={'chip' + (cat === c.id ? ' active' : '')} onClick={() => setCat(c.id)}>{c.emoji} {c.label}</button>)}
      </div>
      {shown.length === 0 ? (
        <div className="card"><Empty icon={<Sparkles size={48} color="var(--primary)" />} title="La trousse è vuota" text="Aggiungi i tuoi prodotti con la data di apertura: ti avviso io quando è ora di cambiarli." /></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {shown.map((p) => <ProductCard key={p.id} p={p} onOpen={() => setEdit(p)} />)}
        </div>
      )}
      {value > 0 && <p className="small muted" style={{ marginTop: 14 }}>Valore della trousse: {value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p>}
      {edit && <ProductEditor product={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function ExpiryBadge({ p }: { p: BeautyProduct }) {
  const e = expiryState(p);
  if (e.state === 'sconosciuta') return null;
  const color = e.state === 'scaduto' ? 'var(--danger)' : e.state === 'presto' ? 'var(--warning)' : 'var(--success)';
  const text = e.state === 'scaduto' ? `scaduto da ${-e.days!} gg` : e.days! <= 60 ? `scade tra ${e.days} gg` : `fino al ${fromISO(e.date!).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}`;
  return <span className="badge" style={{ background: color + '22', color }}>{text}</span>;
}

function ProductCard({ p, onOpen }: { p: BeautyProduct; onOpen: () => void }) {
  const c = beautyCat(p.category);
  return (
    <button className="file-tile" onClick={onOpen} style={{ padding: 12 }}>
      <div className="file-thumb" style={{ background: (p.swatch || '#fbdbe4') + '55', aspectRatio: '4/3' }}>
        {p.image ? <img src={p.image} alt="" /> : <span style={{ fontSize: '2.4rem' }}>{c.emoji}</span>}
      </div>
      <div className="row" style={{ gap: 6 }}>
        {p.swatch && <span className="dot" style={{ background: p.swatch, width: 14, height: 14, boxShadow: '0 0 0 1px var(--border-strong)' }} />}
        <div className="file-name grow">{p.name}</div>
        {p.favorite && <Heart size={14} fill="var(--primary)" color="var(--primary)" />}
      </div>
      <div className="small muted ellipsis">{[p.brand, p.shade].filter(Boolean).join(' · ') || c.label}</div>
      <div className="row between"><ExpiryBadge p={p} />{p.rating > 0 && <span className="tiny">{'★'.repeat(p.rating)}</span>}</div>
    </button>
  );
}

export function ProductEditor({ product, onClose }: { product: BeautyProduct; onClose: () => void }) {
  const ui = useUI();
  const [p, setP] = useState(product);
  const set = <K extends keyof BeautyProduct>(k: K, v: BeautyProduct[K]) => setP((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!p.name.trim()) { ui.toast('Come si chiama il prodotto?', true); return; }
    await db.beauty.put({ ...p, id: p.id || uid(), name: p.name.trim() });
    onClose();
  };
  const photo = async () => {
    const [f] = await pickFiles('image/*', false);
    if (f) set('image', await compressImage(f, 800, 0.8));
  };
  const toWishlist = async () => {
    await db.wishlist.add({ ...blankWish({ title: [p.brand, p.name, p.shade].filter(Boolean).join(' '), category: 'BEAUTY', price: p.price, imageUrl: p.image || null }), id: uid() });
    ui.toast('Aggiunto alla wishlist per ricomprarlo ✨');
  };
  const e = expiryState(p);
  return (
    <Modal title={product.id ? p.name || 'Prodotto' : 'Nuovo prodotto'} size="wide" onClose={onClose} footer={<>
      {product.id && <button className="btn btn-danger" onClick={async () => { await db.beauty.delete(product.id); await db.routine.filter((r) => r.productId === product.id).modify({ productId: null }); onClose(); }}><Trash2 size={16} />Elimina</button>}
      {product.id && <button className="btn" onClick={toWishlist}>Ricompralo</button>}
      <span className="grow" /><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={save}>Salva</button>
    </>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 170px) 1fr', gap: 20 }} className="nb-edit-grid">
        <div className="stack" style={{ gap: 8 }}>
          <button className="file-thumb" onClick={photo} style={{ border: 0, cursor: 'pointer', aspectRatio: '1', background: (p.swatch || '#fbdbe4') + '55' }} aria-label="Foto">
            {p.image ? <img src={p.image} alt="" /> : <span className="small muted"><Camera size={26} /><br />Foto</span>}
          </button>
          {p.image && <button className="btn btn-sm btn-ghost" onClick={() => set('image', '')}><X size={14} />Togli foto</button>}
          <div className="row" style={{ justifyContent: 'center', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((n) => <button key={n} className="icon-btn sm" onClick={() => set('rating', p.rating === n ? 0 : n)} aria-label={`${n} stelle`}><Star size={18} fill={n <= p.rating ? 'var(--warning)' : 'none'} color="var(--warning)" /></button>)}
          </div>
          <div className="row"><Switch checked={p.favorite} onChange={(v) => set('favorite', v)} /><span className="small">Preferito</span></div>
          <div className="row"><Switch checked={p.finished} onChange={(v) => set('finished', v)} /><span className="small">Finito</span></div>
        </div>
        <div className="stack">
          <div className="field-row">
            <label className="field"><span>Prodotto</span><input className="input" autoFocus value={p.name} onChange={(x) => set('name', x.target.value)} placeholder="Es. Mascara volume" /></label>
            <label className="field"><span>Marca</span><input className="input" value={p.brand} onChange={(x) => set('brand', x.target.value)} /></label>
          </div>
          <div className="chips">{BEAUTY_CATS.map((c) => <button key={c.id} className={'chip' + (p.category === c.id ? ' active' : '')} onClick={() => setP((x) => ({ ...x, category: c.id, paoMonths: x.paoMonths ?? PAO_SUGGEST[c.id] ?? null }))}>{c.emoji} {c.label}</button>)}</div>
          <div className="field-row">
            <label className="field"><span>Colore / tonalità</span><input className="input" value={p.shade} onChange={(x) => set('shade', x.target.value)} placeholder="Es. 02 Nude Rose" /></label>
            <label className="field"><span>Prezzo €</span><input className="input" type="number" min={0} step="0.01" value={p.price ?? ''} onChange={(x) => set('price', x.target.value === '' ? null : Number(x.target.value))} /></label>
          </div>
          <div className="field"><span>Colore indicativo</span><Swatches value={p.swatch || '#f5d6c6'} onChange={(c) => set('swatch', c)} colors={SWATCHES} /></div>
          <div className="field-row">
            <label className="field"><span>Aperto il</span><input className="input" type="date" value={p.openedAt} onChange={(x) => set('openedAt', x.target.value)} /></label>
            <label className="field"><span>Dura dopo l’apertura</span>
              <select className="select" value={p.paoMonths ?? ''} onChange={(x) => set('paoMonths', x.target.value ? Number(x.target.value) : null)}>
                <option value="">Non so</option>{[3, 6, 9, 12, 18, 24, 36].map((m) => <option key={m} value={m}>{m}M ({m} mesi)</option>)}
              </select>
            </label>
            <label className="field"><span>Scadenza sulla confezione</span><input className="input" type="date" value={p.expiresAt} onChange={(x) => set('expiresAt', x.target.value)} /></label>
          </div>
          {e.date && <div className="small">{e.state === 'scaduto' ? '⚠️ È scaduto: meglio sostituirlo.' : `Da usare entro il ${fromISO(e.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}.`}</div>}
          <p className="tiny muted" style={{ margin: 0 }}>Il numero accanto al barattolino aperto sulla confezione (6M, 12M…) indica quanti mesi dura dopo l’apertura.</p>
          <label className="field"><span>Note</span><textarea className="textarea" rows={2} value={p.notes} onChange={(x) => set('notes', x.target.value)} placeholder="Come lo usi, con cosa sta bene, se lo ricompreresti…" /></label>
        </div>
      </div>
    </Modal>
  );
}

/* ———————————— Look ———————————— */

function Looks() {
  const looks = useLiveQuery(() => db.looks.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const products = useLiveQuery(() => db.beauty.toArray(), []) ?? [];
  const [edit, setEdit] = useState<Look | null>(null);
  const blank = (): Look => ({ id: '', title: '', occasion: '', steps: '', productIds: [], image: '', rating: 0, favorite: false, createdAt: Date.now() });
  return (
    <>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 14 }}><button className="btn btn-primary" onClick={() => setEdit(blank())}><Plus size={18} />Nuovo look</button></div>
      {looks.length === 0 ? <div className="card"><Empty icon={<Sparkles size={48} color="var(--primary)" />} title="Nessun look salvato" text="Fotografa i trucchi che ti sono venuti bene e annota i prodotti: la prossima volta lo rifai in cinque minuti." /></div> : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {looks.map((l) => (
            <button key={l.id} className="file-tile" onClick={() => setEdit(l)} style={{ padding: 12 }}>
              <div className="file-thumb" style={{ aspectRatio: '3/4', background: 'var(--primary-soft)' }}>{l.image ? <img src={l.image} alt="" /> : <span style={{ fontSize: '2.6rem' }}>💄</span>}</div>
              <div className="row"><div className="file-name grow">{l.title}</div>{l.favorite && <Heart size={14} fill="var(--primary)" color="var(--primary)" />}</div>
              <div className="small muted">{l.occasion || `${l.productIds.length} prodotti`}</div>
              <div className="row" style={{ gap: 3, flexWrap: 'wrap' }}>{l.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean).slice(0, 8).map((p) => <span key={p!.id} className="dot" title={p!.name} style={{ background: p!.swatch || '#ddd', width: 12, height: 12 }} />)}</div>
            </button>
          ))}
        </div>
      )}
      {edit && <LookEditor look={edit} products={products} onClose={() => setEdit(null)} />}
    </>
  );
}

function LookEditor({ look, products, onClose }: { look: Look; products: BeautyProduct[]; onClose: () => void }) {
  const ui = useUI();
  const [l, setL] = useState(look);
  const save = async () => {
    if (!l.title.trim()) { ui.toast('Dai un nome al look', true); return; }
    await db.looks.put({ ...l, id: l.id || uid(), title: l.title.trim() });
    onClose();
  };
  const photo = async () => {
    const [f] = await pickFiles('image/*', false);
    if (f) setL({ ...l, image: await compressImage(f, 1000, 0.82) });
  };
  const available = products.filter((p) => !p.finished || l.productIds.includes(p.id));
  return (
    <Modal title={look.id ? l.title || 'Look' : 'Nuovo look'} size="wide" onClose={onClose} footer={<>
      {look.id && <button className="btn btn-danger" onClick={async () => { await db.looks.delete(look.id); onClose(); }}><Trash2 size={16} />Elimina</button>}
      <span className="grow" /><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={save}>Salva</button>
    </>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', gap: 20 }} className="nb-edit-grid">
        <div className="stack" style={{ gap: 8 }}>
          <button className="file-thumb" onClick={photo} style={{ border: 0, cursor: 'pointer', aspectRatio: '3/4', background: 'var(--primary-soft)' }}>
            {l.image ? <img src={l.image} alt="" /> : <span className="small muted"><ImagePlus size={26} /><br />Aggiungi foto</span>}
          </button>
          <div className="row" style={{ justifyContent: 'center', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((n) => <button key={n} className="icon-btn sm" onClick={() => setL({ ...l, rating: l.rating === n ? 0 : n })}><Star size={18} fill={n <= l.rating ? 'var(--warning)' : 'none'} color="var(--warning)" /></button>)}
          </div>
          <div className="row"><Switch checked={l.favorite} onChange={(v) => setL({ ...l, favorite: v })} /><span className="small">Preferito</span></div>
        </div>
        <div className="stack">
          <div className="field-row">
            <label className="field"><span>Nome</span><input className="input" autoFocus value={l.title} onChange={(e) => setL({ ...l, title: e.target.value })} placeholder="Es. Smokey rosa" /></label>
            <label className="field"><span>Occasione</span><input className="input" value={l.occasion} onChange={(e) => setL({ ...l, occasion: e.target.value })} placeholder="Ufficio, serata, matrimonio…" /></label>
          </div>
          <div className="field"><span>Prodotti usati</span>
            {available.length === 0 ? <span className="small muted">Aggiungi prima i prodotti nella trousse.</span> : (
              <div className="chips">{available.map((p) => {
                const on = l.productIds.includes(p.id);
                return <button key={p.id} className={'chip' + (on ? ' active' : '')} onClick={() => setL({ ...l, productIds: on ? l.productIds.filter((x) => x !== p.id) : [...l.productIds, p.id] })}>
                  {p.swatch && <span className="dot" style={{ background: p.swatch }} />}{p.name}{p.shade ? ` · ${p.shade}` : ''}
                </button>;
              })}</div>
            )}
          </div>
          <label className="field"><span>Passaggi</span><textarea className="textarea" rows={7} value={l.steps} onChange={(e) => setL({ ...l, steps: e.target.value })} placeholder={'1. Primer\n2. Fondotinta con la spugnetta\n3. …'} /></label>
        </div>
      </div>
    </Modal>
  );
}

/* ———————————— Routine skincare ———————————— */

export function useTodayRoutine(date = todayISO()) {
  const steps = useLiveQuery(() => db.routine.orderBy('order').toArray(), []) ?? [];
  const day = useLiveQuery(() => getDay(date), [date]) ?? emptyDay(date);
  const wd = ((new Date().getDay() + 6) % 7) + 1;
  const todays = steps.filter((s) => !s.days.length || s.days.includes(wd));
  const toggle = (s: RoutineStep) => patchDay(date, { routineDone: day.routineDone.includes(s.id) ? day.routineDone.filter((x) => x !== s.id) : [...day.routineDone, s.id] });
  return { steps, todays, done: new Set(day.routineDone), toggle };
}

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

function Routine() {
  const products = useLiveQuery(() => db.beauty.toArray(), []) ?? [];
  const { steps, todays, done, toggle } = useTodayRoutine();
  const [name, setName] = useState({ mattina: '', sera: '' });
  const add = async (when: RoutineStep['when']) => {
    if (!name[when].trim()) return;
    await db.routine.add({ id: uid(), when, name: name[when].trim(), productId: null, days: [], order: steps.length });
    setName({ ...name, [when]: '' });
  };
  return (
    <div className="dash-grid" style={{ marginTop: 0 }}>
      {(['mattina', 'sera'] as const).map((when) => {
        const list = steps.filter((s) => s.when === when);
        const today = todays.filter((s) => s.when === when);
        const n = today.filter((s) => done.has(s.id)).length;
        return (
          <div key={when} className="span-6 card">
            <div className="card-head">
              <h3>{when === 'mattina' ? <Sun size={18} /> : <Moon size={18} />}Routine {when === 'mattina' ? 'del mattino' : 'della sera'}</h3>
              {today.length > 0 && <span className="badge soft">{n}/{today.length} oggi</span>}
            </div>
            {list.length === 0 && <p className="small muted">{when === 'mattina' ? 'Detergente, siero, crema, protezione solare…' : 'Struccante, detergente, tonico, crema notte…'}</p>}
            {list.map((s) => {
              const isToday = today.includes(s);
              return (
                <div key={s.id} className="todo" style={{ opacity: isToday ? 1 : 0.55 }}>
                  <input type="checkbox" className="checkbox" checked={done.has(s.id)} disabled={!isToday} onChange={() => toggle(s)} aria-label="Fatto oggi" />
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div className="row wrap tiny" style={{ gap: 4, marginTop: 4 }}>
                      <select className="select" style={{ minHeight: 30, padding: '0 28px 0 8px', fontSize: '.78rem', width: 'auto' }} value={s.productId ?? ''} onChange={(e) => db.routine.update(s.id, { productId: e.target.value || null })}>
                        <option value="">Nessun prodotto</option>{products.filter((p) => !p.finished).map((p) => <option key={p.id} value={p.id}>{p.brand ? p.brand + ' ' : ''}{p.name}</option>)}
                      </select>
                      {WEEKDAYS.map((w, i) => {
                        const on = s.days.includes(i + 1);
                        return <button key={i} className={'chip' + (on ? ' active' : '')} style={{ minHeight: 26, padding: '0 8px', fontSize: '.72rem' }} onClick={() => db.routine.update(s.id, { days: on ? s.days.filter((d) => d !== i + 1) : [...s.days, i + 1].sort() })}>{w}</button>;
                      })}
                    </div>
                  </div>
                  <button className="icon-btn sm danger" onClick={() => db.routine.delete(s.id)} aria-label="Elimina"><Trash2 size={15} /></button>
                </div>
              );
            })}
            <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); void add(when); }}>
              <input className="input" value={name[when]} onChange={(e) => setName({ ...name, [when]: e.target.value })} placeholder="Aggiungi un passaggio" />
              <button className="btn btn-soft" type="submit"><Plus size={16} /></button>
            </form>
            <p className="tiny muted" style={{ marginBottom: 0 }}>Nessun giorno selezionato = tutti i giorni. Esfoliante o maschera? Scegli i giorni giusti.</p>
          </div>
        );
      })}
    </div>
  );
}
