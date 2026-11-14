import { useState } from 'react';
import { LogIn, Sparkles, UserPlus } from 'lucide-react';
import { setLocal } from '../db/settings';
import { AuthDialog } from '../components/AccountPanel';
import { HeartDoodle } from '../components/ui';

/** La prima schermata, come nell'app iPhone: accedi, crea l'account o prova senza. */
export function Benvenuto({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'register' | null>(null);
  return (
    <div className="lock welcome" style={{ overflowY: 'auto', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 420, width: '100%' }}>
        <HeartDoodle size={110} />
        <h1 style={{ fontSize: '2.6rem', marginTop: 8 }}>Nina</h1>
        <p style={{ color: 'var(--text-2)', fontSize: '1.05rem', margin: '8px 0 28px' }}>
          Le tue giornate, i tuoi quaderni e un po’ di cura per te.<br />Sincronizzata su iPhone, iPad e computer.
        </p>
        <div className="stack">
          <button className="btn btn-primary btn-block" style={{ minHeight: 52, fontSize: '1rem' }} onClick={() => setMode('login')}><LogIn size={18} />Accedi</button>
          <button className="btn btn-soft btn-block" style={{ minHeight: 52, fontSize: '1rem' }} onClick={() => setMode('register')}><UserPlus size={18} />Crea un account</button>
          <button className="btn btn-ghost btn-block" onClick={async () => { await setLocal('welcomeDone', true); onDone(); }}><Sparkles size={16} />Continua senza account</button>
        </div>
        <p className="tiny muted" style={{ marginTop: 18 }}>Senza account i dati restano solo su questo dispositivo. Puoi accedere quando vuoi da Impostazioni.</p>
      </div>
      {mode && <AuthDialog mode={mode} setMode={setMode} onClose={() => { setMode(null); }} />}
    </div>
  );
}
