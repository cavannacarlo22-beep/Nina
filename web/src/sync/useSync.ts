import { useEffect, useState } from 'react';
import { currentSession, type PublicUser } from './api';
import { getSyncState, subscribeSync, type SyncState } from './engine';

/** L'utente collegato, o null se Nina è usata solo su questo dispositivo. */
export function useSession(): PublicUser | null {
  const [user, setUser] = useState<PublicUser | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () => void currentSession().then((s) => alive && setUser(s?.user ?? null));
    read();
    window.addEventListener('nina-session', read);
    return () => { alive = false; window.removeEventListener('nina-session', read); };
  }, []);
  return user;
}

export function useSyncState(): SyncState {
  const [s, setS] = useState(getSyncState());
  useEffect(() => subscribeSync(setS), []);
  return s;
}
