import { useEffect, useState } from 'react';
import { Cloud, CloudOff, LogIn, LogOut, RefreshCw, Server, UserPlus } from 'lucide-react';
import { forgotPassword, getServerUrl, login, logoutRemote, register, serverHealth, setServerUrl, ApiError } from '../sync/api';
import { syncNow, wipeLocalData } from '../sync/engine';
import { useSession, useSyncState } from '../sync/useSync';
import { fmtRelative } from '../lib/dates';
import { createBackup } from '../lib/backup';
import { download } from '../lib/files';
import { Modal, useUI } from './ui';

export function AccountPanel() {
  const ui = useUI();
  const user = useSession();
  const st = useSyncState();
  const [mode, setMode] = useState<'login' | 'register' | null>(null);
  const [serverOpen, setServerOpen] = useState(false);

  const logout = async () => {
    const pending = st.pending;
    const ok = await ui.confirm({
      title: 'Uscire dall’account?',
      message: pending
        ? `Ci sono ${pending} modifiche non ancora sincronizzate: se esci adesso andranno perse. Collegati a internet e aspetta “Tutto sincronizzato”, oppure scarica prima un backup.`
        : 'I tuoi dati restano al sicuro sul server. Da questo dispositivo verranno cancellati: ritornano appena accedi di nuovo.',
      ok: 'Esci', danger: true,
    });
    if (!ok) return;
    if (pending && !(await ui.confirm({ title: 'Sicura?', message: 'Scarico prima un backup di sicurezza di questo dispositivo.', ok: 'Scarica backup ed esci' }))) return;
    if (pending) { const b = await createBackup(); download(b.blob, b.name); }
    await logoutRemote();
    await wipeLocalData();
    ui.toast('Sei uscita. A presto 💗');
  };

  return (
    <div className="stack">
      {user ? (
        <>
          <div className="row">
            <span className="list-emoji" style={{ background: 'var(--primary-soft)', fontWeight: 700, color: 'var(--primary-strong)' }}>{user.displayName.slice(0, 1).toUpperCase()}</span>
            <div className="grow"><b>{user.displayName}</b><div className="small muted">{user.email}</div></div>
            <button className="btn btn-sm" onClick={() => syncNow()} disabled={st.status === 'syncing'}><RefreshCw size={15} className={st.status === 'syncing' ? 'spin' : ''} />Sincronizza</button>
          </div>
          <div className={'notice' + (st.status === 'error' ? ' warn' : '')}>
            {st.status === 'offline' || st.status === 'error' ? <CloudOff size={18} /> : <Cloud size={18} />}
            <span>
              {st.status === 'syncing' && 'Sincronizzo…'}
              {st.status === 'idle' && (st.pending ? `${st.pending} modifiche in attesa di essere inviate.` : 'Tutto sincronizzato su tutti i tuoi dispositivi.')}
              {st.status === 'offline' && 'Sei offline: continua pure, sincronizzo appena torna la rete 💗'}
              {st.status === 'error' && `La sincronizzazione si è fermata: ${st.message}`}
              {st.status === 'off' && 'In attesa…'}
              {st.lastSyncAt > 0 && <span className="muted"> Ultima volta {fmtRelative(st.lastSyncAt)}.</span>}
              {st.live && <span className="muted"> Aggiornamenti in tempo reale attivi.</span>}
            </span>
          </div>
          <button className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-start' }} onClick={logout}><LogOut size={15} />Esci</button>
        </>
      ) : (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            Con un account Nina i tuoi dati si sincronizzano fra iPad, iPhone e computer, e restano al sicuro anche se perdi il dispositivo.
            Senza account funziona tutto lo stesso, ma solo su questo dispositivo.
          </p>
          <div className="row wrap">
            <button className="btn btn-primary" onClick={() => setMode('login')}><LogIn size={16} />Accedi</button>
            <button className="btn btn-soft" onClick={() => setMode('register')}><UserPlus size={16} />Crea un account</button>
          </div>
        </>
      )}
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setServerOpen(true)}><Server size={14} />Indirizzo del server</button>
      {mode && <AuthDialog mode={mode} setMode={setMode} onClose={() => setMode(null)} />}
      {serverOpen && <ServerDialog onClose={() => setServerOpen(false)} />}
    </div>
  );
}

function AuthDialog({ mode, setMode, onClose }: { mode: 'login' | 'register'; setMode: (m: 'login' | 'register') => void; onClose: () => void }) {
  const ui = useUI();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [server, setServer] = useState('');
  useEffect(() => { void getServerUrl().then(setServer); }, []);

  const submit = async () => {
    setErr('');
    if (!server) { setErr('Manca l’indirizzo del server di Nina: impostalo con “Indirizzo del server”.'); return; }
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else {
        if (password.length < 10) throw new Error('La password deve avere almeno 10 caratteri: una frase che ricordi va benissimo.');
        await register({ email, password, firstName: first.trim() || 'Io', lastName: last.trim() || '-', displayName: first.trim() || undefined });
      }
      ui.toast(mode === 'login' ? 'Bentornata 💗 Sincronizzo i tuoi dati…' : 'Account creato 🎉 Carico i tuoi dati…');
      void syncNow();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 0 ? 'Non riesco a raggiungere il server. Controlla la connessione (il server gratuito può impiegare un minuto a svegliarsi: riprova tra poco).' : e instanceof Error ? e.message : 'Qualcosa è andato storto');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={mode === 'login' ? 'Accedi a Nina' : 'Crea il tuo account'} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Non hai un account?' : 'Hai già un account?'}</button>
      <span className="grow" />
      <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Un attimo…' : mode === 'login' ? 'Accedi' : 'Crea account'}</button>
    </>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {mode === 'register' && (
          <div className="field-row">
            <label className="field"><span>Nome</span><input className="input" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} /></label>
            <label className="field"><span>Cognome</span><input className="input" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} /></label>
          </div>
        )}
        <label className="field"><span>Email</span><input className="input" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span>Password</span><input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {mode === 'register' && <p className="tiny muted" style={{ margin: 0 }}>Almeno 10 caratteri. I dati che hai già su questo dispositivo verranno caricati nell’account.</p>}
        {mode === 'login' && <p className="tiny muted" style={{ margin: 0 }}>Quello che hai già su questo dispositivo si unisce ai dati dell’account, senza perdere niente.</p>}
        {err && <div className="notice warn"><span>{err}</span></div>}
        {mode === 'login' && <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={async () => {
          if (!email) { setErr('Scrivi prima la tua email.'); return; }
          try { await forgotPassword(email); ui.toast('Se l’email è registrata, ti arriva un link per reimpostare la password'); } catch (e) { setErr(e instanceof Error ? e.message : 'Errore'); }
        }}>Password dimenticata?</button>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function ServerDialog({ onClose }: { onClose: () => void }) {
  const ui = useUI();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'?' | 'ok' | 'ko' | '…'>('?');
  useEffect(() => { void getServerUrl().then(setUrl); }, []);
  const test = async () => { setStatus('…'); setStatus((await serverHealth(url)) ? 'ok' : 'ko'); };
  const save = async () => { await setServerUrl(url); ui.toast('Indirizzo salvato'); onClose(); };
  return (
    <Modal title="Server di Nina" onClose={onClose} footer={<><button className="btn" onClick={test}>Prova</button><button className="btn btn-primary" onClick={save}>Salva</button></>}>
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>L’indirizzo del backend di Nina (per esempio quello di Render). Di solito è già impostato e non serve cambiarlo.</p>
        <input className="input" value={url} onChange={(e) => { setUrl(e.target.value); setStatus('?'); }} placeholder="https://nina-backend.onrender.com" inputMode="url" />
        {status === '…' && <span className="small muted">Provo… (se il server dormiva può volerci un minuto)</span>}
        {status === 'ok' && <span className="small" style={{ color: 'var(--success)' }}>Il server risponde ✓</span>}
        {status === 'ko' && <span className="small" style={{ color: 'var(--danger)' }}>Il server non risponde. Controlla l’indirizzo o riprova tra un minuto.</span>}
      </div>
    </Modal>
  );
}
