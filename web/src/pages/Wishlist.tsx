import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink, Gift, ImagePlus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { db, uid } from '../db/db';
import type { WishCategory, WishItem } from '../db/types';
import { compressImage, pickFiles } from '../lib/files';
import * as voce from '../content/voce';
import { Empty, Modal, useUI } from '../components/ui';

export const WISH_CATS: { id: WishCategory; label: string; emoji: string }[] = [
  { id: 'MODA', label: 'Moda', emoji: '👗' }, { id: 'BEAUTY', label: 'Beauty', emoji: '💄' }, { id: 'CASA', label: 'Casa', emoji: '🕯️' },
  { id: 'TECH', label: 'Tech', emoji: '🎧' }, { id: 'VIAGGI', label: 'Viaggi', emoji: '✈️' }, { id: 'LIBRI', label: 'Libri', emoji: '📚' },
  { id: 'ESPERIENZE', label: 'Esperienze', emoji: '🎟️' }, { id: 'ALTRO', label: 'Altro', emoji: '✨' },
];
const euro = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

export function blankWish(p: Partial<WishItem> = {}): WishItem {
  return { id: '', title: '', description: null, price: null, currency: 'EUR', imageUrl: null, productUrl: null, category: 'ALTRO', isPurchased: false, purchasedAt: null, createdAt: new Date().toISOString(), ...p };
}

export default function Wishlist() {
  const items = useLiveQuery(() => db.wishlist.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const [cat, setCat] = useState<WishCategory | ''>('');
  const [showBought, setShowBought] = useState(false);
  const [edit, setEdit] = useState<WishItem | null>(null);
  const shown = items.filter((i) => (!cat || i.category === cat) && i.isPurchased === showBought);
  const total = items.filter((i) => !i.isPurchased && i.price).reduce((s, i) => s + (i.price ?? 0), 0);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Wishlist</h1><p>{items.length ? `${items.filter((i) => !i.isPurchased).length} desideri${total ? ` · ${euro(total)} in tutto` : ''}` : voce.nienteWishlist()}</p></div>
        <button className="btn btn-primary" onClick={() => setEdit(blankWish({ category: cat || 'ALTRO' }))}><Plus size={18} />Desiderio</button>
      </div>
      <div className="row wrap" style={{ marginBottom: 16 }}>
        <div className="chips scroll grow">
          <button className={'chip' + (!cat ? ' active' : '')} onClick={() => setCat('')}>Tutti</button>
          {WISH_CATS.map((c) => <button key={c.id} className={'chip' + (cat === c.id ? ' active' : '')} onClick={() => setCat(c.id)}>{c.emoji} {c.label}</button>)}
        </div>
        <div className="seg"><button className={!showBought ? 'active' : ''} onClick={() => setShowBought(false)}>Da avere</button><button className={showBought ? 'active' : ''} onClick={() => setShowBought(true)}>Presi</button></div>
      </div>
      {shown.length === 0 ? <div className="card"><Empty icon={<Gift size={48} color="var(--primary)" />} title={showBought ? 'Niente ancora' : 'Lista dei sogni vuota'} text={voce.nienteWishlist()} /></div> : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {shown.map((i) => (
            <button key={i.id} className="file-tile" onClick={() => setEdit(i)} style={{ padding: 12 }}>
              <div className="file-thumb" style={{ background: 'var(--primary-soft)', aspectRatio: '1' }}>
                {i.imageUrl ? <img src={i.imageUrl} alt="" /> : <span style={{ fontSize: '2.6rem' }}>{WISH_CATS.find((c) => c.id === i.category)?.emoji}</span>}
              </div>
              <div className="file-name">{i.title}</div>
              <div className="row between small"><span className="muted">{WISH_CATS.find((c) => c.id === i.category)?.label}</span>{i.price != null && <b>{euro(i.price)}</b>}</div>
            </button>
          ))}
        </div>
      )}
      {edit && <WishEditor item={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

export function WishEditor({ item, onClose }: { item: WishItem; onClose: () => void }) {
  const ui = useUI();
  const [w, setW] = useState(item);
  const save = async () => {
    if (!w.title.trim()) { ui.toast('Come si chiama?', true); return; }
    const rec: WishItem = { ...w, id: w.id || uid(), title: w.title.trim().slice(0, 200), price: w.price != null && w.price >= 0 ? Math.round(w.price * 100) / 100 : null, purchasedAt: w.isPurchased ? w.purchasedAt ?? new Date().toISOString() : null };
    await db.wishlist.put(rec);
    if (!item.id) ui.toast('Aggiunto alla wishlist ✨');
    onClose();
  };
  const photo = async () => {
    const [f] = await pickFiles('image/*', false);
    if (f) setW({ ...w, imageUrl: await compressImage(f, 700, 0.8) });
  };
  return (
    <Modal title={item.id ? 'Desiderio' : 'Nuovo desiderio'} onClose={onClose} footer={<>
      {item.id && <button className="btn btn-danger" onClick={async () => { await db.wishlist.delete(item.id); onClose(); }}><Trash2 size={16} />Elimina</button>}
      <span className="grow" /><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={save}>Salva</button>
    </>}>
      <div className="stack">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <button className="file-thumb" onClick={photo} style={{ width: 96, aspectRatio: '1', border: 0, cursor: 'pointer', flexShrink: 0 }} aria-label="Foto">
            {w.imageUrl ? <img src={w.imageUrl} alt="" /> : <ImagePlus size={26} color="var(--muted)" />}
          </button>
          <div className="stack grow" style={{ gap: 8 }}>
            <input className="input" autoFocus value={w.title} onChange={(e) => setW({ ...w, title: e.target.value })} placeholder="Cosa ti piacerebbe?" />
            <div className="row">
              <input className="input" type="number" min={0} step="0.01" value={w.price ?? ''} onChange={(e) => setW({ ...w, price: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Prezzo €" />
              {w.imageUrl && <button className="icon-btn sm" onClick={() => setW({ ...w, imageUrl: null })} aria-label="Togli foto"><X size={14} /></button>}
            </div>
          </div>
        </div>
        <div className="chips">{WISH_CATS.map((c) => <button key={c.id} className={'chip' + (w.category === c.id ? ' active' : '')} onClick={() => setW({ ...w, category: c.id })}>{c.emoji} {c.label}</button>)}</div>
        <div className="row">
          <input className="input" type="url" value={w.productUrl ?? ''} onChange={(e) => setW({ ...w, productUrl: e.target.value || null })} placeholder="Link al negozio (facoltativo)" />
          {w.productUrl && <a className="icon-btn" href={w.productUrl} target="_blank" rel="noopener noreferrer" aria-label="Apri"><ExternalLink size={18} /></a>}
        </div>
        <textarea className="textarea" rows={2} value={w.description ?? ''} onChange={(e) => setW({ ...w, description: e.target.value || null })} placeholder="Taglia, colore, perché ti piace…" />
        <div className="row"><input type="checkbox" className="checkbox" id="pres" checked={w.isPurchased} onChange={(e) => setW({ ...w, isPurchased: e.target.checked })} /><label htmlFor="pres"><ShoppingBag size={14} style={{ verticalAlign: -2 }} /> Preso!</label></div>
      </div>
    </Modal>
  );
}
