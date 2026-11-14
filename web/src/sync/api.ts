/**
 * Il client delle API di Nina.
 *
 * - L'access token dura poco (15 minuti) e si rinnova da solo con il refresh
 *   token. Il rinnovo è uno solo alla volta: il server ruota il refresh token a
 *   ogni uso, e due rinnovi in parallelo con lo stesso token verrebbero letti
 *   come un furto (e chiuderebbero tutte le sessioni).
 * - Ogni richiesta porta l'id del dispositivo: serve al server per decidere i
 *   conflitti e per non rimandare a un dispositivo le sue stesse modifiche.
 */
import { db, uid } from '../db/db';

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

interface Session {
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  accessExpiresAt: number;
  user: PublicUser;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

const DEFAULT_SERVER = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

let cache: { server: string; deviceId: string; session: Session | null } | null = null;

async function state() {
  if (cache) return cache;
  const [server, deviceId, session] = await Promise.all([
    db.localSettings.get('serverUrl'),
    db.localSettings.get('deviceId'),
    db.localSettings.get('session'),
  ]);
  let dev = deviceId?.value as string | undefined;
  if (!dev) {
    dev = 'web-' + uid();
    await db.localSettings.put({ key: 'deviceId', value: dev });
  }
  cache = { server: (server?.value as string) || DEFAULT_SERVER, deviceId: dev, session: (session?.value as Session) ?? null };
  return cache;
}

export async function getServerUrl(): Promise<string> {
  return (await state()).server;
}
export async function setServerUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/$/, '');
  await db.localSettings.put({ key: 'serverUrl', value: clean });
  (await state()).server = clean;
}
export async function getDeviceId(): Promise<string> {
  return (await state()).deviceId;
}
export async function currentSession(): Promise<Session | null> {
  return (await state()).session;
}
async function saveSession(s: Session | null) {
  (await state()).session = s;
  if (s) await db.localSettings.put({ key: 'session', value: s });
  else await db.localSettings.delete('session');
  window.dispatchEvent(new CustomEvent('nina-session'));
}

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPad|Macintosh.*Mobile|Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Browser';
}

async function headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const s = await state();
  return {
    'X-Nina-Device-Id': s.deviceId,
    'X-Nina-Device-Name': deviceName(),
    'X-Nina-Platform': 'web',
    'X-Nina-App-Version': '2.0.0',
    ...extra,
  };
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Errore ${res.status}`;
  let code: string | undefined;
  try {
    const body = await res.json();
    message = body?.error?.message ?? body?.message ?? message;
    code = body?.error?.code;
  } catch {
    /* ignore */
  }
  return new ApiError(res.status, message, code);
}

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const server = (await state()).server;
  if (!server) throw new ApiError(0, 'Nessun server configurato');
  try {
    return await fetch(server + path, init);
  } catch {
    throw new ApiError(0, 'Non riesco a raggiungere il server');
  }
}

function toSession(body: { accessToken: string; refreshToken: string; accessTokenExpiresIn: number; user: PublicUser }): Session {
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    accessExpiresAt: Date.now() + (body.accessTokenExpiresIn - 30) * 1000,
    user: body.user,
  };
}

let refreshing: Promise<Session | null> | null = null;

async function doRefresh(): Promise<Session | null> {
  const s = await state();
  // un altro giro (o un'altra scheda) può averlo già rinnovato
  const stored = (await db.localSettings.get('session'))?.value as Session | undefined;
  if (stored && stored.accessExpiresAt > Date.now() + 5000) {
    s.session = stored;
    return stored;
  }
  const current = stored ?? s.session;
  if (!current) return null;
  const res = await rawFetch('/auth/refresh', {
    method: 'POST',
    headers: await headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  if (res.status === 401 || res.status === 403) {
    await saveSession(null);
    window.dispatchEvent(new CustomEvent('nina-session-expired'));
    return null;
  }
  if (!res.ok) throw await parseError(res);
  const next = toSession(await res.json());
  await saveSession(next);
  return next;
}

async function refreshSession(): Promise<Session | null> {
  if (!refreshing) {
    const run = () => doRefresh();
    const locks = (navigator as Navigator & { locks?: { request: (n: string, cb: () => Promise<Session | null>) => Promise<Session | null> } }).locks;
    refreshing = (locks ? locks.request('nina-refresh', run) : run()).finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function validAccessToken(): Promise<string | null> {
  const s = await state();
  if (!s.session) return null;
  if (s.session.accessExpiresAt > Date.now()) return s.session.accessToken;
  return (await refreshSession())?.accessToken ?? null;
}

/** Chiamata autenticata. Rinnova il token una volta se il server risponde 401. */
export async function api(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const { json, ...rest } = init;
  const build = async (token: string) => {
    const h = await headers((rest.headers as Record<string, string>) ?? {});
    h.Authorization = `Bearer ${token}`;
    if (json !== undefined) h['Content-Type'] = 'application/json';
    return rawFetch(path, { ...rest, headers: h, body: json !== undefined ? JSON.stringify(json) : rest.body });
  };
  let token = await validAccessToken();
  if (!token) throw new ApiError(401, 'Devi accedere per sincronizzare');
  let res = await build(token);
  if (res.status === 401) {
    token = (await refreshSession())?.accessToken ?? null;
    if (!token) throw new ApiError(401, 'La sessione è scaduta: accedi di nuovo');
    res = await build(token);
  }
  if (!res.ok) throw await parseError(res);
  return res;
}

export async function apiJson<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  return (await api(path, init)).json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<PublicUser> {
  const res = await rawFetch('/auth/login', {
    method: 'POST',
    headers: await headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  if (!res.ok) throw await parseError(res);
  const s = toSession(await res.json());
  await saveSession(s);
  return s.user;
}

export async function register(input: { email: string; password: string; firstName: string; lastName: string; displayName?: string }): Promise<PublicUser> {
  const res = await rawFetch('/auth/register', {
    method: 'POST',
    headers: await headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...input, email: input.email.trim().toLowerCase() }),
  });
  if (!res.ok) throw await parseError(res);
  const s = toSession(await res.json());
  await saveSession(s);
  return s.user;
}

export async function forgotPassword(email: string): Promise<void> {
  const res = await rawFetch('/auth/forgot-password', {
    method: 'POST',
    headers: await headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (!res.ok) throw await parseError(res);
}

export async function logoutRemote(): Promise<void> {
  const s = await state();
  if (s.session) {
    try {
      await rawFetch('/auth/logout', {
        method: 'POST',
        headers: await headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ refreshToken: s.session.refreshToken }),
      });
    } catch {
      /* offline: la sessione scadrà da sola */
    }
  }
  await saveSession(null);
}

export async function serverHealth(url?: string): Promise<boolean> {
  try {
    const base = (url ?? (await state()).server).replace(/\/$/, '');
    if (!base) return false;
    const res = await fetch(base + '/health');
    return res.ok;
  } catch {
    return false;
  }
}

/** Per i test: dimentica la cache in memoria. */
export function resetApiCache(): void {
  cache = null;
}
