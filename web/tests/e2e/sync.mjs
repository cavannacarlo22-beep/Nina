// Due dispositivi sullo stesso account, contro un backend di Nina vero.
// Uso: backend su :3000 (CORS http://localhost:4173), app costruita con
// VITE_API_URL=http://localhost:3000 e servita su :4173, poi
//   node tests/e2e/sync.mjs [cartella-screenshot]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const OUT = process.argv[2] ?? 'test-results';
mkdirSync(OUT, { recursive: true });
const errors = [];
let current = null;
const step = async (name, fn) => {
  try { await fn(); console.log('✓', name); }
  catch (e) {
    console.log('✗', name, '\n   ', e.message.split('\n')[0]); errors.push(name);
    if (current) await current.screenshot({ path: `${OUT}/ERR-${name.replace(/\W+/g, '_')}.png` }).catch(() => {});
  }
};

const email = `prova.${Date.now()}@example.com`;
const password = 'una frase lunga che ricordo';

const browser = await chromium.launch();
const ipadCtx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, locale: 'it-IT', timezoneId: 'Europe/Rome' });
const phoneCtx = await browser.newContext({ ...devices['iPhone 13'], locale: 'it-IT', timezoneId: 'Europe/Rome' });
const ipad = await ipadCtx.newPage();
const phone = await phoneCtx.newPage();
for (const [n, p] of [['iPad', ipad], ['iPhone', phone]]) {
  p.setDefaultTimeout(15000);
  await p.addInitScript(() => {
    window.addEventListener('unhandledrejection', (e) => console.log('REJ', String(e.reason), e.reason && e.reason.stack));
    window.addEventListener('error', (e) => console.log('ERR', e.message, e.error && e.error.stack));
  });
  p.on('console', (m) => { const t = m.text(); if (/^(REJ|ERR)/.test(t)) console.log(`   [${n}]`, t.slice(0, 600)); });
  p.on('pageerror', (e) => { console.log(`   [${n}] pageerror:`, e.message, (e.stack||'').split('\n').slice(0,4).join(' | ')); errors.push(`${n} pageerror`); });
}

const waitSynced = async (p) => {
  await p.goto(BASE + '#/impostazioni');
  await p.waitForSelector('text=Tutto sincronizzato su tutti i tuoi dispositivi', { timeout: 30000 });
};

await step('iPad: uso senza account (offline-first)', async () => {
  current = ipad;
  await ipad.goto(BASE);
  await ipad.click('button:has-text("Continua senza account")');
  await ipad.goto(BASE + '#/cose');
  await ipad.fill('textarea[placeholder="Aggiungi un’attività…"]', 'Comprare il latte');
  await ipad.keyboard.press('Enter');
  await ipad.waitForSelector('.todo-text[value="Comprare il latte"]');
  await ipad.goto(BASE + '#/quaderni');
  await ipad.click('button:has-text("Nuovo quaderno") >> nth=0');
  await ipad.fill('input[placeholder^="Es. Inglese"]', 'Inglese');
  await ipad.click('.modal-foot >> text=Crea quaderno');
  await ipad.click('.ProseMirror');
  await ipad.keyboard.type('Present perfect: have + past participle.');
  await ipad.waitForSelector('.word-count:has-text("Salvato")');
  await ipad.goto(BASE + '#/archivio');
  const [chooser] = await Promise.all([ipad.waitForEvent('filechooser'), ipad.click('button:has-text("Carica file")')]);
  await chooser.setFiles([{ name: 'ricetta.txt', mimeType: 'text/plain', buffer: Buffer.from('Tiramisù: mascarpone, uova, savoiardi, caffè') }]);
  await ipad.waitForSelector('.file-tile:has-text("ricetta.txt")');
  await ipad.goto(BASE + '#/beauty');
  await ipad.click('button:has-text("Prodotto")');
  await ipad.fill('input[placeholder="Es. Mascara volume"]', 'Rossetto nude');
  await ipad.click('.modal-foot >> text=Salva');
  await ipad.waitForSelector('.file-name:has-text("Rossetto nude")');
  await ipad.goto(BASE + '#/umore');
  await ipad.click('.mood-btn[title="Bene"]');
  await ipad.waitForSelector('.mood-btn.active');
});

await step('iPad: crea l’account e carica tutto', async () => {
  await ipad.goto(BASE + '#/impostazioni');
  await ipad.click('button:has-text("Crea un account")');
  await ipad.fill('input[autocomplete="given-name"]', 'Giulia');
  await ipad.fill('input[autocomplete="family-name"]', 'Prova');
  await ipad.fill('input[type="email"]', email);
  await ipad.fill('input[type="password"]', password);
  await ipad.click('.modal-foot >> text=Crea account');
  await waitSynced(ipad);
  await ipad.screenshot({ path: `${OUT}/sync-01-ipad-account.png` });
});

await step('iPhone: accede e ritrova tutto', async () => {
  current = phone;
  await phone.goto(BASE);
  // la prima schermata, come sull'app iPhone: si accede da lì
  await phone.click('.lock button:has-text("Accedi")');
  await phone.fill('input[type="email"]', email);
  await phone.fill('input[type="password"]', password);
  await phone.click('.modal-foot >> text=Accedi');
  await waitSynced(phone);
  await phone.goto(BASE + '#/cose');
  await phone.click('.list-card:has-text("Tutte")');
  await phone.waitForSelector('.todo-text[value="Comprare il latte"]');
  await phone.goto(BASE + '#/quaderni');
  await phone.click('.nb-cover:has-text("Inglese")');
  await phone.waitForSelector('.ProseMirror:has-text("Present perfect")');
  await phone.screenshot({ path: `${OUT}/sync-02-iphone-quaderno.png` });
  await phone.goto(BASE + '#/beauty');
  await phone.waitForSelector('.file-name:has-text("Rossetto nude")');
  await phone.goto(BASE + '#/umore');
  await phone.waitForSelector('.mood-btn.active[title="Bene"]');
});

await step('iPhone: apre il file caricato dall’iPad (scaricato dal server)', async () => {
  await phone.goto(BASE + '#/archivio');
  await phone.click('.file-tile:has-text("ricetta.txt")');
  await phone.waitForSelector('pre:has-text("mascarpone")');
  await phone.keyboard.press('Escape');
});

await step('tempo reale: ciò che scrivi sull’iPhone compare sull’iPad senza ricaricare', async () => {
  await ipad.goto(BASE + '#/cose');
  await ipad.click('.list-card:has-text("Tutte")');
  await phone.goto(BASE + '#/cose');
  await phone.click('.list-card:has-text("Tutte")');
  await phone.fill('textarea[placeholder="Aggiungi un’attività…"]', 'Dal telefono 📱');
  await phone.keyboard.press('Enter');
  current = ipad;
  await ipad.waitForSelector('.todo-text[value="Dal telefono 📱"]', { timeout: 20000 });
  await ipad.screenshot({ path: `${OUT}/sync-03-ipad-tempo-reale.png` });
});

await step('cancellazione: eliminata sull’iPad, sparisce dall’iPhone', async () => {
  const row = ipad.locator('.todo', { has: ipad.locator('.todo-text[value="Comprare il latte"]') });
  await row.locator('button[aria-label="Dettagli"]').click();
  await ipad.click('.modal-foot >> text=Elimina');
  await ipad.locator('.modal').last().locator('.modal-foot button:has-text("Elimina")').click();
  current = phone;
  await phone.waitForSelector('.todo-text[value="Comprare il latte"]', { state: 'detached', timeout: 20000 });
});

await step('la mia amica risponde', async () => {
  current = ipad;
  await ipad.goto(BASE + '#/amica');
  await ipad.fill('textarea[placeholder="Scrivi a Nina…"]', 'Oggi sono un po’ stanca');
  await ipad.keyboard.press('Enter');
  await ipad.waitForSelector('text=Nina sta scrivendo…', { state: 'detached', timeout: 20000 });
  await ipad.waitForSelector('text=Oggi sono un po’ stanca');
  const bubbles = await ipad.locator('.page .card div[style*="pre-wrap"]').count();
  if (bubbles < 2) throw new Error('nessuna risposta dall’amica');
  await ipad.screenshot({ path: `${OUT}/sync-04-amica.png` });
});

await step('iPhone: uscendo i dati spariscono dal dispositivo', async () => {
  current = phone;
  await waitSynced(phone);
  await phone.click('button:has-text("Esci")');
  await phone.click('.modal-foot >> text=Esci');
  await phone.waitForSelector('button:has-text("Crea un account")');
  await phone.reload();
  const cont = phone.locator('button:has-text("Continua senza account")');
  if (await cont.isVisible().catch(() => false)) await cont.click();
  await phone.goto(BASE + '#/beauty');
  await phone.waitForSelector('text=La trousse è vuota');
});

await browser.close();
console.log(errors.length ? `\n${errors.length} problemi` : '\nTutto ok');
process.exit(errors.length ? 1 : 0);
