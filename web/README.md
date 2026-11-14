# Nina — app web (iPad, iPhone, computer)

L'app di Nina che si apre dal browser e si installa sulla schermata Home
dell'iPad e dell'iPhone, **senza App Store e senza abbonamento Apple**.
Unisce le funzioni di Nina con quelle di Petalo (quaderni, agenda, archivio…),
senza doppioni.

## Le sezioni

| | |
|---|---|
| 🏠 **Home** | saluto e pensiero del giorno di Nina, le cose di oggi, come stai e l'acqua, calendario, appuntamenti, da ricordare, conto alla rovescia, ultimi appunti, un momento per te, beauty, studio, documenti, calcolo veloce. Riquadri nascondibili e riordinabili. |
| ✓ **Cose da fare** | un'attività sola, vista in più modi: Oggi (con quelle rimaste indietro), In programma, Tutte, Completate, Da ricordare (le note veloci di Nina, trasformabili in attività) e tutte le **liste** che vuoi (spesa, viaggi, film…), riordinabili trascinando. Giorno, ora, categoria, priorità, ripetizioni, promemoria, note. |
| 📅 **Agenda** | giorno, settimana, mese, elenco; appuntamenti con categorie colorate, ripetizioni, promemoria, conto alla rovescia in Home; mostra anche le attività con una data. Esporta in Calendario Apple (.ics). |
| 📒 **Quaderni** | un quaderno per argomento, capitoli e sottocapitoli, editor completo con 302 font, immagini, allegati, tabelle, disegno e scrittura con Apple Pencil, cerca e sostituisci, esporta PDF/Word. |
| ⏱️ **Studio** | timer di concentrazione collegato ai quaderni, statistiche della settimana e tempo dedicato a ogni quaderno. |
| 🧮 **Calcoli** · 🗂️ **Archivio** · 🔤 **Font** | calcolatrice e tabelle con formule; archivio di PDF, Word, Excel e foto con anteprime e annotazioni; libreria di 302 Google Fonts. |
| 💗 **Umore e diario** | sei stati d'animo, una nota, il calendario del mese e il diario privato. |
| 🔥 **Abitudini** | ogni giorno, alcuni giorni o N volte a settimana; serie di giorni consecutivi e record. |
| 🌸 **Benessere** | acqua, sonno, ciclo con previsione, tre cose belle di oggi. |
| 🧖 **Self care** | quaranta idee vere per categoria e durata, e **Respira**: esercizio di respirazione guidato. |
| 💄 **Beauty** | la trousse con foto, tonalità e **scadenze** (data di apertura + il barattolino "12M"), avvisi per i prodotti scaduti, look salvati con i prodotti usati, routine skincare di mattina e sera. |
| ✨ **Wishlist** · 🫶 **La mia amica** · 📈 **Progressi** | desideri con foto e prezzo; la chat con Nina; quello che hai fatto, senza classifiche. |

## Come salva i dati

Le schermate leggono e scrivono **solo sul dispositivo** (IndexedDB): Nina è
veloce e funziona anche senza rete. Se accedi con il tuo account, un motore di
sincronizzazione manda le modifiche al server di Nina e riceve quelle degli
altri dispositivi — lo stesso protocollo dell'app iOS (`docs/SYNC.md`): cursore
per utente, vince la modifica più recente, le cancellazioni vincono sempre.
Gli aggiornamenti arrivano in tempo reale (Server-Sent Events).

- Attività, abitudini, mood, diario, wishlist, note veloci e messaggi usano le
  tabelle native del server.
- Quaderni, agenda, liste, cartelle, tabelle, beauty… viaggiano come
  **documenti** (`documents`, migration 005).
- Il contenuto dei file dell'archivio si carica a parte (`PUT /files/:id`) e
  ogni dispositivo lo scarica solo quando lo apre.

Senza account funziona tutto lo stesso, solo su quel dispositivo. Al primo
accesso i dati già presenti vengono uniti all'account.

## Sviluppo

```bash
npm install
VITE_API_URL=http://localhost:3000 npm run dev     # con il backend acceso
npm test                                           # 44 test unitari
```

Prove end-to-end in un browser vero (backend su :3000 con
`CORS_ORIGINS=http://localhost:4173`):

```bash
VITE_API_URL=http://localhost:3000 npm run build
npx vite preview --port 4173 &
node tests/e2e/smoke.mjs     # 20 controlli: tutte le sezioni, iPad e telefono
node tests/e2e/sync.mjs      # 8 controlli: due dispositivi sullo stesso account
```

## Pubblicazione

Vedi [`docs/APP_WEB.md`](../docs/APP_WEB.md).
