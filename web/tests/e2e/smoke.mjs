// End-to-end smoke test on a real browser, iPad-sized.
// Usage: npm run build && npx vite preview --port 4173 &  node tests/e2e/smoke.mjs [outDir]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const OUT = process.argv[2] ?? 'test-results';
mkdirSync(OUT, { recursive: true });
const errors = [];
const step = async (name, fn) => {
  try { await fn(); console.log('✓', name); }
  catch (e) {
    console.log('✗', name, '\n   ', e.message.split('\n')[0]); errors.push(name);
    await page.screenshot({ path: `${OUT}/ERR-${name.replace(/\W+/g, '_')}.png` }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
  }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, locale: 'it-IT', timezoneId: 'Europe/Rome' });
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
page.on('pageerror', (e) => { console.log('   pageerror:', e.message); errors.push('pageerror: ' + e.message); });
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text())) console.log('   console:', m.text()); });
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });

await page.goto(BASE);
await page.waitForSelector('.hero');

await step('Home: personalizza nome', async () => {
  await page.click('button[title="Personalizza saluto e frase"]');
  await page.fill('input[placeholder="Come vuoi che ti chiami Nina?"]', 'Giulia');
  await page.click('.modal-foot >> text=Salva');
  await page.click('button[title="Personalizza saluto e frase"]');
  const v = await page.inputValue('input[placeholder="Come vuoi che ti chiami Nina?"]');
  if (v !== 'Giulia') throw new Error('nome non salvato: ' + v);
  await page.keyboard.press('Escape');
  await shot('01-home');
});

await step('Promemoria in dashboard', async () => {
  await page.fill('input[placeholder="Devo ricordarmi di…"]', 'Comprare le penne');
  await page.keyboard.press('Enter');
  await page.waitForSelector('text=Comprare le penne');
});

await step('Agenda: nuovo appuntamento', async () => {
  await page.click('a[href="#/agenda"]');
  await page.click('button:has-text("Nuovo")');
  await page.fill('input[placeholder^="Es. Parrucchiera"]', 'Lezione di Statistica');
  await page.click('.modal .chip:has-text("Studio")');
  await page.click('.modal-foot >> text=Salva');
  await page.waitForSelector('.ev-pill:has-text("Lezione di Statistica")');
  await page.click('.seg >> text=Settimana');
  await page.waitForSelector('.week-ev:has-text("Lezione di Statistica")');
  await shot('02-agenda-settimana');
  await page.click('.seg >> text=Mese');
  await shot('03-agenda-mese');
});

await step('Calcolatrice', async () => {
  await page.click('a[href="#/calcoli"]');
  await page.fill('.calc-expr', '200+10%');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.calc-result:has-text("220")');
  await page.fill('.calc-expr', '√144+2^3');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.calc-result:has-text("20")');
  await shot('04-calcolatrice');
});

await step('Tabella con formule', async () => {
  await page.click('.seg >> text=Tabelle');
  await page.click('button:has-text("Crea tabella")');
  await page.click('.modal .list-card:has-text("Tabella vuota")');
  await page.click('.modal-foot >> text=Salva');
  await page.waitForSelector('.sheet');
  const cell = (r, c) => page.locator('.sheet tbody tr').nth(r).locator('td').nth(c);
  await cell(0, 0).click();
  for (const v of ['10', '20', '30', '=SOMMA(A1:A3)']) { await page.keyboard.type(v); await page.keyboard.press('Enter'); }
  await page.waitForTimeout(100);
  const t = await cell(3, 0).innerText();
  if (t.trim() !== '60') throw new Error('somma = ' + t);
  await shot('05-tabella');
});

await step('Cose da fare: crea lista e attività', async () => {
  await page.click('a[href="#/cose"]');
  await page.click('button:has-text("Nuova lista")');
  await page.fill('input[placeholder^="Es. Spesa"]', 'Esame di Statistica');
  await page.click('.modal-foot >> text=Crea');
  await page.waitForSelector('h2:has-text("Esame di Statistica")');
  await page.fill('textarea[placeholder^="Aggiungi un’attività"]', 'Ripassare capitolo 1\nEsercizi pagina 40\nSimulazione esame');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.todo >> nth=2');
  await page.locator('.todo .checkbox').first().click();
  await page.waitForSelector('text=1 di 3 completate');
  await shot('06-liste');
});

await step('Archivio: carica file e cartella', async () => {
  await page.click('a[href="#/archivio"]');
  await page.click('button:has-text("Nuova cartella")');
  await page.fill('input[placeholder="Es. Economia aziendale"]', 'Statistica');
  await page.click('.modal-foot >> text=Crea');
  await page.waitForSelector('.file-tile:has-text("Statistica")');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('button:has-text("Carica file")')]);
  await chooser.setFiles([{ name: 'programma.txt', mimeType: 'text/plain', buffer: Buffer.from('Programma del corso di Statistica') }]);
  await page.waitForSelector('.file-tile:has-text("programma.txt")');
  await page.fill('input[placeholder^="Cerca un documento"]', 'program');
  await page.waitForSelector('.file-tile:has-text("programma.txt")');
  await page.click('.file-tile:has-text("programma.txt")');
  await page.waitForSelector('pre:has-text("Programma del corso")');
  await page.keyboard.press('Escape');
  await page.fill('input[placeholder^="Cerca un documento"]', '');
  await shot('07-archivio');
});

await step('Quaderno: crea, scrivi, formatta, font', async () => {
  await page.click('a[href="#/quaderni"]');
  await page.click('button:has-text("Nuovo quaderno") >> nth=0');
  await page.fill('input[placeholder^="Es. Inglese"]', 'Statistica');
  await page.click('.modal-foot >> text=Crea quaderno');
  await page.waitForSelector('.ProseMirror');
  await page.click('.ProseMirror');
  await page.keyboard.type('La media aritmetica è la somma dei valori divisa per il loro numero.');
  await page.keyboard.press('Control+a');
  await page.click('button[aria-label="Grassetto (⌘B)"]');
  await page.click('.tb-select[title="Carattere"]');
  await page.fill('.font-pop input', 'Caveat');
  await page.click('.font-opt:has-text("Caveat")');
  await page.waitForTimeout(800);
  const html = await page.locator('.ProseMirror').innerHTML();
  if (!html.includes('<strong>') || !html.includes('Caveat')) throw new Error('formattazione non applicata: ' + html.slice(0, 200));
  const loaded = await page.evaluate(() => document.fonts.check('16px "Caveat"'));
  if (!loaded) throw new Error('font Caveat non caricato');
  await page.waitForSelector('.word-count:has-text("Salvato")');
  await shot('08-quaderno');
});

await step('Quaderno: sottocapitolo e ricerca', async () => {
  await page.click('button:has-text("Sottocapitolo")');
  await page.waitForSelector('.tree-item.active:has-text("Senza titolo")');
  await page.fill('.note-title', 'Varianza');
  await page.waitForSelector('.tree-item.active:has-text("Varianza")');
  await page.click('.ProseMirror');
  await page.keyboard.type('La varianza misura la dispersione.');
  await page.waitForSelector('.word-count:has-text("Salvato")');
  await page.fill('.nb-side input[placeholder="Cerca negli appunti"]', 'dispersione');
  await page.waitForSelector('.nb-tree .list-card:has-text("Varianza")');
  await page.fill('.nb-side input[placeholder="Cerca negli appunti"]', '');
});

await step('Quaderno: disegno a mano ed esportazione Word', async () => {
  await page.click('button[aria-label="Disegna / scrivi a mano (Apple Pencil)"]');
  const canvas = page.locator('.modal canvas').last();
  await canvas.waitFor();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 50, box.y + 50);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(box.x + 50 + i * 12, box.y + 50 + Math.sin(i / 3) * 30);
  await page.mouse.up();
  await page.click('.modal-foot >> text=Inserisci negli appunti');
  await page.waitForSelector('.ProseMirror figure[data-drawing] img');
  await page.waitForSelector('.word-count:has-text("Salvato")');
  await page.click('button[title="Esporta e stampa"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.menu >> text=Esporta Word (.doc)')]);
  if (!dl.suggestedFilename().endsWith('.doc')) throw new Error(dl.suggestedFilename());
});

await step('Libreria font', async () => {
  await page.goto(BASE + '#/font');
  await page.waitForSelector('.font-card');
  const count = await page.locator('.page-head p').innerText();
  if (!/30\d famiglie/.test(count)) throw new Error(count);
  await page.fill('input[placeholder="Cerca un font per nome"]', 'Great Vibes');
  await page.waitForSelector('.font-card:has-text("Great Vibes")');
  await page.fill('input[placeholder="Cerca un font per nome"]', '');
  await page.waitForTimeout(1500);
  await shot('09-font');
});

await step('Studio: timer collegato al quaderno', async () => {
  await page.goto(BASE + '#/studio');
  await page.selectOption('.card select', { label: '📒 Statistica' });
  await page.click('button:has-text("Avvia")');
  await page.waitForTimeout(1200);
  const t = await page.locator('.timer-big').innerText();
  if (t === '25:00') throw new Error('il timer non parte');
  await page.click('button:has-text("Pausa") >> nth=-1');
  await shot('10-studio');
});

await step('Beauty: prodotto con scadenza', async () => {
  await page.goto(BASE + '#/beauty');
  await page.click('button:has-text("Prodotto")');
  await page.fill('input[placeholder="Es. Mascara volume"]', 'Mascara volume');
  await page.click('.modal .chip:has-text("Occhi")');
  await page.fill('.modal input[type="date"] >> nth=0', '2025-01-10');
  await page.click('.modal-foot >> text=Salva');
  await page.waitForSelector('.badge:has-text("scaduto")');
  await shot('10b-beauty');
});

await step('Abitudini e umore', async () => {
  await page.goto(BASE + '#/abitudini');
  await page.click('button:has-text("Nuova abitudine")');
  await page.fill('input[placeholder="Es. Leggere 20 minuti"]', 'Leggere 20 minuti');
  await page.click('.modal-foot >> text=Salva');
  await page.click('button:has-text("Segna come fatto")');
  await page.waitForSelector('text=Primo giorno fatto');
  await page.goto(BASE + '#/umore');
  await page.click('.mood-btn[title="Fantastica"]');
  await page.click('button:has-text("Scrivi")');
  await page.fill('textarea[placeholder="Caro diario…"]', 'Oggi ho finito il quaderno di statistica.');
  await page.click('.modal-foot >> text=Salva');
  await page.waitForSelector('text=Oggi ho finito il quaderno');
  await shot('11-umore');
});

await step('Benessere e self care', async () => {
  await page.goto(BASE + '#/benessere');
  await page.click('.water button >> nth=2');
  await page.waitForSelector('text=3/8 bicchieri');
  await page.goto(BASE + '#/selfcare');
  await page.click('button:has-text("Inizia")');
  await page.waitForSelector('text=Inspira');
  await page.click('button:has-text("Basta così")');
  await shot('11b-selfcare');
});

await step('Impostazioni e backup', async () => {
  await page.goto(BASE + '#/impostazioni');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Scarica backup completo")')]);
  if (!dl.suggestedFilename().endsWith('.zip')) throw new Error(dl.suggestedFilename());
  await shot('12-impostazioni');
});

await step('Persistenza dopo ricarica', async () => {
  await page.reload();
  await page.goto(BASE + '#/agenda?v=list');
  await page.waitForSelector('text=Lezione di Statistica');
  await page.goto(BASE + '#/quaderni');
  await page.click('.nb-cover:has-text("Statistica")');
  await page.click('.tree-title:has-text("Introduzione")');
  await page.waitForSelector('.ProseMirror:has-text("media aritmetica")');
  await page.click('.tree-title:has-text("Varianza")');
  await page.waitForSelector('.ProseMirror figure[data-drawing] img');
  await page.click('.tree-title:has-text("Introduzione")');
  await page.waitForSelector('.ProseMirror:has-text("media aritmetica")');
  const html = await page.locator('.ProseMirror').innerHTML();
  if (!html.includes('Caveat') || !html.includes('<strong>')) throw new Error('formattazione persa dopo il riavvio');
  await page.goto(BASE + '#/cose');
  await page.waitForSelector('text=Esame di Statistica');
  await page.goto(BASE + '#/');
  await page.click('button[title="Personalizza saluto e frase"]');
  if ((await page.inputValue('input[placeholder="Come vuoi che ti chiami Nina?"]')) !== 'Giulia') throw new Error('nome perso');
  await page.keyboard.press('Escape');
});

await step('Tema notte', async () => {
  await page.goto(BASE + '#/impostazioni');
  await page.click('button:has-text("Notte rosa")');
  await page.goto(BASE + '#/');
  await page.waitForTimeout(400);
  await shot('13-notte');
  await page.goto(BASE + '#/impostazioni');
  await page.click('button:has-text("Rosa cipria")');
});

// iPad portrait and phone
for (const [name, vp] of [['ipad-verticale', { width: 820, height: 1180 }], ['telefono', { width: 390, height: 844 }]]) {
  await step('Layout ' + name, async () => {
    await page.setViewportSize(vp);
    await page.goto(BASE + '#/');
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) throw new Error('scroll orizzontale');
    await shot('14-' + name + '-home');
    await page.goto(BASE + '#/quaderni');
    await page.click('.nb-cover:has-text("Statistica")');
    await page.waitForSelector('.ProseMirror');
    await shot('15-' + name + '-quaderno');
  });
}

await browser.close();
console.log(errors.length ? `\n${errors.length} problemi` : '\nTutto ok');
process.exit(errors.length ? 1 : 0);
