import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  BookHeart, Calculator, CalendarHeart, Cloud, CloudOff, Flame, Flower2, FolderHeart, Gift, HardDrive, Heart, HeartHandshake, Home, ListChecks,
  Menu, MoreHorizontal, RefreshCw, Settings as SettingsIcon, Sparkles, Timer, TrendingUp, Type, Wind,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { HeartsBackdrop } from './components/Hearts';
import { startSync } from './sync/engine';
import { useSession, useSyncState } from './sync/useSync';
import { UIProvider, useUI } from './components/ui';
import { db, ensureDefaults, requestPersistence } from './db/db';
import { getSettings, setSetting, useSettingsLoaded } from './db/settings';
import { collectDueReminders, showSystemNotification } from './lib/notify';
import { takeSnapshot } from './lib/backup';
import { todayISO } from './lib/dates';
import { LockScreen } from './pages/LockScreen';
import HomePage from './pages/Home';

const Agenda = lazy(() => import('./pages/Agenda'));
const Calcoli = lazy(() => import('./pages/Calcoli'));
const CoseDaFare = lazy(() => import('./pages/CoseDaFare'));
const Archivio = lazy(() => import('./pages/Archivio'));
const Quaderni = lazy(() => import('./pages/Quaderni'));
const Notebook = lazy(() => import('./pages/NotebookView'));
const FontLibrary = lazy(() => import('./pages/FontLibrary'));
const Studio = lazy(() => import('./pages/Studio'));
const Umore = lazy(() => import('./pages/Umore'));
const Abitudini = lazy(() => import('./pages/Abitudini'));
const Benessere = lazy(() => import('./pages/Benessere'));
const SelfCare = lazy(() => import('./pages/SelfCare'));
const Beauty = lazy(() => import('./pages/Beauty'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Amica = lazy(() => import('./pages/Amica'));
const Progressi = lazy(() => import('./pages/Progressi'));
const Impostazioni = lazy(() => import('./pages/Impostazioni'));

type NavItem = { to: string; label: string; icon: typeof Home; end?: boolean };
export const NAV_GROUPS: { title?: string; items: NavItem[] }[] = [
  { items: [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/cose', label: 'Cose da fare', icon: ListChecks },
    { to: '/agenda', label: 'Agenda', icon: CalendarHeart },
  ] },
  { title: 'Studio e organizzazione', items: [
    { to: '/quaderni', label: 'Quaderni', icon: BookHeart },
    { to: '/studio', label: 'Studio', icon: Timer },
    { to: '/calcoli', label: 'Calcoli matematici', icon: Calculator },
    { to: '/archivio', label: 'Archivio documenti', icon: FolderHeart },
    { to: '/font', label: 'Libreria dei font', icon: Type },
  ] },
  { title: 'Per te', items: [
    { to: '/umore', label: 'Umore e diario', icon: Heart },
    { to: '/abitudini', label: 'Abitudini', icon: Flame },
    { to: '/benessere', label: 'Benessere', icon: Flower2 },
    { to: '/selfcare', label: 'Self care', icon: Wind },
    { to: '/beauty', label: 'Beauty', icon: Sparkles },
    { to: '/wishlist', label: 'Wishlist', icon: Gift },
    { to: '/amica', label: 'La mia amica', icon: HeartHandshake },
    { to: '/progressi', label: 'Progressi', icon: TrendingUp },
  ] },
];

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const today = todayISO();
  const pending = useLiveQuery(() => db.tasks.filter((t) => !t.isCompleted && !!t.date && t.date <= today).count(), [today]);
  const todayEvents = useLiveQuery(() => db.events.where('date').equals(today).count(), [today]);
  return (
    <nav className={'sidebar' + (open ? ' open' : '')} aria-label="Menu principale">
      <div className="brand">
        <div className="brand-mark"><Sparkles size={20} /></div>
        <div className="brand-name">Nina<small>il tuo spazio</small></div>
      </div>
      {NAV_GROUPS.map((g, gi) => (
        <div key={gi} style={{ display: 'contents' }}>
          {g.title && <div className="nav-section">{g.title}</div>}
          {g.items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link" onClick={onNavigate} title={label}>
              <Icon className="nav-ico" strokeWidth={1.8} />
              <span className="nav-label">{label}</span>
              {to === '/agenda' && !!todayEvents && <span className="badge soft">{todayEvents}</span>}
              {to === '/cose' && !!pending && <span className="badge soft">{pending}</span>}
            </NavLink>
          ))}
        </div>
      ))}
      <div className="nav-section" />
      <NavLink to="/impostazioni" className="nav-link" onClick={onNavigate} title="Impostazioni">
        <SettingsIcon className="nav-ico" strokeWidth={1.8} />
        <span className="nav-label">Impostazioni</span>
      </NavLink>
      <SyncFooter />
    </nav>
  );
}

function SyncFooter() {
  const user = useSession();
  const st = useSyncState();
  const text = !user ? 'Salvato su questo dispositivo'
    : st.status === 'syncing' ? 'Sincronizzo…'
      : st.status === 'offline' ? 'Offline: salvo qui'
        : st.status === 'error' ? 'Sincronizzazione in pausa'
          : st.pending ? `${st.pending} modifiche da inviare` : 'Tutto sincronizzato';
  const Icon = !user ? HardDrive : st.status === 'offline' || st.status === 'error' ? CloudOff : st.status === 'syncing' ? RefreshCw : Cloud;
  return (
    <NavLink to="/impostazioni" className="sidebar-foot" style={{ textDecoration: 'none' }} title={st.message || text}>
      <Icon size={14} color={st.status === 'error' ? 'var(--danger)' : 'var(--blue-strong)'} /> <span>{text}</span>
    </NavLink>
  );
}

function TabBar({ onMore }: { onMore: () => void }) {
  return (
    <nav className="tabbar" aria-label="Navigazione rapida">
      <NavLink to="/" end><Home size={22} />Home</NavLink>
      <NavLink to="/agenda"><CalendarHeart size={22} />Agenda</NavLink>
      <NavLink to="/cose"><ListChecks size={22} />Da fare</NavLink>
      <NavLink to="/quaderni"><BookHeart size={22} />Quaderni</NavLink>
      <button onClick={onMore}><MoreHorizontal size={22} />Altro</button>
    </nav>
  );
}

const TITLES: Record<string, string> = Object.fromEntries([
  ...NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.to, i.label])),
  ['/impostazioni', 'Impostazioni'],
]);

function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const base = '/' + (loc.pathname.split('/')[1] ?? '');
  const isNotebook = /^\/quaderni\/[^/]+/.test(loc.pathname);
  return (
    <div className={'app' + (isNotebook ? ' nb-mode' : '')}>
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      {open && <div className="overlay" style={{ zIndex: 29, background: 'rgba(75,44,56,.18)' }} onClick={() => setOpen(false)} />}
      <div className="main">
        {!isNotebook && (
          <header className="topbar">
            <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Apri menu"><Menu size={22} /></button>
            <div className="topbar-title">{TITLES[base] ?? 'Nina'}</div>
            <div id="topbar-actions" className="row" />
          </header>
        )}
        <Suspense fallback={<div className="page muted">Un attimo…</div>}>{children}</Suspense>
      </div>
      <TabBar onMore={() => setOpen(true)} />
    </div>
  );
}

/** Background jobs: reminders, automatic snapshots, storage persistence. */
function Background() {
  const ui = useUI();
  useEffect(() => {
    void requestPersistence();
    const stopSync = startSync();
    const onExpired = () => ui.toast('La sessione è scaduta: accedi di nuovo dalle Impostazioni per sincronizzare', true);
    window.addEventListener('nina-session-expired', onExpired);
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const due = await collectDueReminders();
        for (const r of due) {
          ui.toast(`⏰ ${r.title} — ${r.body}`);
          await showSystemNotification(r.title, r.body);
        }
      } catch (e) {
        console.error(e);
      }
    };
    const snapshot = async () => {
      const s = await getSettings();
      if (s.autoSnapshot && Date.now() - s.lastSnapshotAt > 24 * 3600 * 1000) {
        try {
          await takeSnapshot();
          await setSetting('lastSnapshotAt', Date.now());
        } catch (e) {
          console.error('Snapshot non riuscito', e);
        }
      }
    };
    void tick();
    const t1 = setInterval(tick, 20_000);
    const t0 = setTimeout(snapshot, 8000);
    const t2 = setInterval(snapshot, 60 * 60 * 1000);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => { stopSync(); window.removeEventListener('nina-session-expired', onExpired); stopped = true; clearInterval(t1); clearTimeout(t0); clearInterval(t2); document.removeEventListener('visibilitychange', onVis); };
  }, [ui]);
  return null;
}

function Themed({ children }: { children: ReactNode }) {
  const s = useSettingsLoaded();
  const [unlocked, setUnlocked] = useState(false);
  const [lastActive, setLastActive] = useState(Date.now());

  useEffect(() => {
    if (!s) return;
    const root = document.documentElement;
    root.dataset.theme = s.theme;
    if (s.theme !== 'notte' && s.accent && s.theme === 'rosa') {
      root.style.setProperty('--primary', s.accent);
    } else {
      root.style.removeProperty('--primary');
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', s.theme === 'notte' ? '#1f1820' : '#fff6f7');
  }, [s]);

  // auto-lock after inactivity
  useEffect(() => {
    if (!s?.pinHash || !s.lockAfterMinutes) return;
    const bump = () => setLastActive(Date.now());
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    const t = setInterval(() => {
      if (Date.now() - lastActive > s.lockAfterMinutes * 60000) setUnlocked(false);
    }, 15000);
    const onVis = () => {
      if (document.visibilityState === 'hidden') setLastActive(Date.now());
      else if (Date.now() - lastActive > s.lockAfterMinutes * 60000) setUnlocked(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(t);
    };
  }, [s?.pinHash, s?.lockAfterMinutes, lastActive]);

  if (!s) return null;
  return (
    <>
      {s.hearts && <HeartsBackdrop />}
      {s.pinHash && !unlocked ? <LockScreen hash={s.pinHash} salt={s.pinSalt} onUnlock={() => { setUnlocked(true); setLastActive(Date.now()); }} /> : children}
    </>
  );
}

export default function App() {
  useEffect(() => { void ensureDefaults(); }, []);
  return (
    <UIProvider>
      <Themed>
        <HashRouter>
          <Background />
          <Shell>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/calcoli" element={<Calcoli />} />
              <Route path="/cose" element={<CoseDaFare />} />
              <Route path="/cose/:listId" element={<CoseDaFare />} />
              <Route path="/liste" element={<CoseDaFare />} />
              <Route path="/archivio" element={<Archivio />} />
              <Route path="/archivio/:folderId" element={<Archivio />} />
              <Route path="/quaderni" element={<Quaderni />} />
              <Route path="/quaderni/:notebookId" element={<Notebook />} />
              <Route path="/quaderni/:notebookId/:noteId" element={<Notebook />} />
              <Route path="/font" element={<FontLibrary />} />
              <Route path="/studio" element={<Studio />} />
              <Route path="/umore" element={<Umore />} />
              <Route path="/abitudini" element={<Abitudini />} />
              <Route path="/benessere" element={<Benessere />} />
              <Route path="/selfcare" element={<SelfCare />} />
              <Route path="/beauty" element={<Beauty />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/amica" element={<Amica />} />
              <Route path="/progressi" element={<Progressi />} />
              <Route path="/impostazioni" element={<Impostazioni />} />
              <Route path="*" element={<HomePage />} />
            </Routes>
          </Shell>
        </HashRouter>
      </Themed>
    </UIProvider>
  );
}
