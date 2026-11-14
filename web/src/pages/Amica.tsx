import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { HeartHandshake, Send, Trash2 } from 'lucide-react';
import { db, markRemote } from '../db/db';
import { useSettings } from '../db/settings';
import { apiJson, ApiError } from '../sync/api';
import { adoptFromServer } from '../sync/engine';
import { useSession } from '../sync/useSync';
import * as voce from '../content/voce';
import { Empty, useUI } from '../components/ui';

const SPUNTI = ['Oggi è stata una giornata pesante', 'Non riesco a concentrarmi', 'Ho bisogno di motivazione', 'Raccontami qualcosa di bello', 'Come faccio a dormire meglio?'];

export default function Amica() {
  const ui = useUI();
  const s = useSettings();
  const session = useSession();
  const messages = useLiveQuery(() => db.friendMessages.orderBy('createdAt').toArray(), []) ?? [];
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, sending]);

  const send = async (content = text) => {
    const c = content.trim();
    if (!c || sending) return;
    setSending(true);
    setText('');
    try {
      const res = await apiJson<{ message: Record<string, unknown>; reply: Record<string, unknown> }>('/friend/messages', {
        method: 'POST', json: { content: c.slice(0, 4000), hour: new Date().getHours() },
      });
      await adoptFromServer([{ entity: 'friendMessages', data: res.message }, { entity: 'friendMessages', data: res.reply }]);
    } catch (e) {
      setText(c);
      ui.toast(e instanceof ApiError && e.status === 0 ? voce.offline() : e instanceof Error ? e.message : voce.erroreGentile(), true);
    } finally {
      setSending(false);
    }
  };

  const clear = async () => {
    if (!(await ui.confirm({ title: 'Cancellare la conversazione?', message: 'I messaggi verranno eliminati da tutti i tuoi dispositivi.', ok: 'Cancella', danger: true }))) return;
    try {
      await apiJson('/friend/messages', { method: 'DELETE' });
      await db.transaction('rw', db.friendMessages, async (tx) => { markRemote(tx); await db.friendMessages.clear(); });
    } catch {
      ui.toast(voce.erroreGentile(), true);
    }
  };

  if (!session) {
    return (
      <div className="page">
        <div className="page-head"><div><h1>La mia amica</h1><p>Qualcuno con cui parlare, anche alle due di notte.</p></div></div>
        <div className="card"><Empty icon={<HeartHandshake size={52} color="var(--primary)" />} title="Serve il tuo account Nina"
          text="Le risposte dell’amica arrivano dal server di Nina: accedi e potrai chiacchierare da qualsiasi dispositivo."
          action={<Link className="btn btn-primary" to="/impostazioni">Accedi o crea l’account</Link>} /></div>
      </div>
    );
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 90px)' }}>
      <div className="page-head">
        <div><h1>La mia amica</h1><p>Scrivile quello che ti passa per la testa. Resta tra voi due.</p></div>
        {messages.length > 0 && <button className="btn btn-ghost btn-sm" onClick={clear}><Trash2 size={15} />Cancella</button>}
      </div>
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 360 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <div style={{ fontSize: '2.4rem' }}>🌸</div>
            <h3 style={{ marginTop: 8 }}>Ciao{s.name ? ` ${s.name}` : ''}, come stai davvero?</h3>
            <div className="chips" style={{ justifyContent: 'center', marginTop: 14 }}>
              {SPUNTI.map((t) => <button key={t} className="chip" onClick={() => send(t)}>{t}</button>)}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.author === 'USER' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: 'min(560px, 82%)', padding: '10px 14px', borderRadius: 20, whiteSpace: 'pre-wrap', lineHeight: 1.45,
              background: m.author === 'USER' ? 'var(--primary)' : 'var(--surface-2)', color: m.author === 'USER' ? 'var(--on-primary)' : 'var(--text)',
              borderBottomRightRadius: m.author === 'USER' ? 6 : 20, borderBottomLeftRadius: m.author === 'USER' ? 20 : 6,
            }}>
              {m.content}
              <div className="tiny" style={{ opacity: 0.7, marginTop: 4, textAlign: 'right' }}>{new Date(m.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        ))}
        {sending && <div className="small muted">Nina sta scrivendo…</div>}
        <div ref={endRef} />
      </div>
      <form className="row" style={{ marginTop: 12, position: 'sticky', bottom: 'calc(10px + var(--safe-b))' }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <textarea className="textarea" rows={1} style={{ minHeight: 48, height: 48 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Scrivi a Nina…" />
        <button className="btn btn-primary" type="submit" disabled={sending || !text.trim()} aria-label="Invia"><Send size={18} /></button>
      </form>
      <p className="tiny muted" style={{ textAlign: 'center' }}>Nina è un’amica, non una professionista. Se stai male davvero, parlane con qualcuno di cui ti fidi o chiama il 112.</p>
    </div>
  );
}
