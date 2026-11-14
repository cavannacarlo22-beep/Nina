import type { BeautyCategory, BeautyProduct } from '../db/types';
import { addMonths, fromISO, toISO, todayISO } from './dates';

export const BEAUTY_CATS: { id: BeautyCategory; label: string; emoji: string }[] = [
  { id: 'viso', label: 'Viso', emoji: '🧴' }, { id: 'occhi', label: 'Occhi', emoji: '👁️' }, { id: 'labbra', label: 'Labbra', emoji: '💋' },
  { id: 'guance', label: 'Guance', emoji: '🌸' }, { id: 'sopracciglia', label: 'Sopracciglia', emoji: '✏️' }, { id: 'unghie', label: 'Unghie', emoji: '💅' },
  { id: 'skincare', label: 'Skincare', emoji: '🧖‍♀️' }, { id: 'capelli', label: 'Capelli', emoji: '💇‍♀️' }, { id: 'profumi', label: 'Profumi', emoji: '🌹' },
  { id: 'strumenti', label: 'Pennelli e strumenti', emoji: '🖌️' }, { id: 'altro', label: 'Altro', emoji: '✨' },
];
export const beautyCat = (c: BeautyCategory) => BEAUTY_CATS.find((x) => x.id === c) ?? BEAUTY_CATS[BEAUTY_CATS.length - 1];

/** Durata tipica dopo l'apertura (il simbolo col barattolino), in mesi. */
export const PAO_SUGGEST: Partial<Record<BeautyCategory, number>> = {
  occhi: 6, labbra: 12, viso: 12, guance: 24, sopracciglia: 12, unghie: 24, skincare: 12, capelli: 12, profumi: 36,
};

/** La data di scadenza vera: la prima fra la confezione e l'apertura + PAO. */
export function expiryOf(p: Pick<BeautyProduct, 'openedAt' | 'paoMonths' | 'expiresAt'>): string | null {
  const candidates: string[] = [];
  if (p.openedAt && p.paoMonths) candidates.push(toISO(addMonths(fromISO(p.openedAt), p.paoMonths)));
  if (p.expiresAt) candidates.push(p.expiresAt);
  return candidates.sort()[0] ?? null;
}

export type ExpiryState = 'ok' | 'presto' | 'scaduto' | 'sconosciuta';
export function expiryState(p: BeautyProduct): { state: ExpiryState; days: number | null; date: string | null } {
  const date = expiryOf(p);
  if (!date) return { state: 'sconosciuta', days: null, date };
  const days = Math.round((fromISO(date).getTime() - fromISO(todayISO()).getTime()) / 86400000);
  return { state: days < 0 ? 'scaduto' : days <= 30 ? 'presto' : 'ok', days, date };
}

export const SWATCHES = ['#f5d6c6', '#eac0a6', '#d9a383', '#b57d5a', '#8a5a3c', '#5a3a26', '#e8a0a8', '#d4626f', '#b23a4a', '#8c2232', '#f4a6c0', '#c97bb2', '#9b7bd0', '#7fb5e0', '#5a8f7b', '#2b2b33', '#c9a96e', '#e6e6e6'];
