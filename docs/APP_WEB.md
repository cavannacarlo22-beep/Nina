# Pubblicare l'app web di Nina

L'app web vive in `web/` e si pubblica su **Vercel** (gratis). Parla con lo
stesso backend dell'app iOS, quello su Render (`docs/SERVER_ONLINE.md`).

Sull'iPad e sull'iPhone si installa da Safari con **Condividi → Aggiungi alla
schermata Home**: niente App Store, niente abbonamento sviluppatore Apple,
niente rinnovi ogni sette giorni.

## 1. Il backend deve accettare l'app web

Un browser parla con un server di un altro indirizzo solo se il server lo
autorizza (CORS). Su **Render → nina-backend → Environment**:

- `CORS_ORIGINS` = l'indirizzo dell'app web, per esempio
  `https://nina-web.vercel.app` (più indirizzi separati da virgola, senza `/`
  finale).

Salva: il servizio si riavvia da solo.

Prima di questa versione il backend va aggiornato (migration
`005_quaderni_e_documenti.sql`, rotte `/files`, correzione CORS dello stream):
succede da solo al primo deploy del branch che contiene queste modifiche, perché
`render.yaml` esegue le migration a ogni avvio.

## 2. Vercel

1. **vercel.com → Add New… → Project** → importa il repository **Nina**.
2. **Root Directory**: `web`. Il resto lo legge da `web/vercel.json`.
3. **Environment Variables**: `VITE_API_URL` = l'indirizzo del backend, per
   esempio `https://nina-backend-xxxx.onrender.com` (senza `/` finale).
4. **Deploy**.

Se `VITE_API_URL` manca l'app funziona lo stesso, senza account: l'indirizzo
del server si può scrivere a mano in **Impostazioni → Account → Indirizzo del
server**.

## 3. Il primo accesso

Le registrazioni sul server sono chiuse di proposito. Per creare l'account:

1. Render → `REGISTRAZIONI_APERTE` = `si` → Save, aspetta il riavvio;
2. apri l'app web → **Impostazioni → Crea un account**;
3. Render → `REGISTRAZIONI_APERTE` = `no` → Save.

Se l'account esiste già (creato con l'app iOS) basta **Accedi**: attività,
abitudini, umore, diario, wishlist e messaggi arrivano subito.

## Limiti da sapere

- **Spazio**: il piano gratuito di Neon ha circa 0,5 GB. Appunti e agenda
  pesano pochissimo; i file dell'archivio (massimo 25 MB l'uno) e le foto nei
  quaderni sono quelli che lo riempiono.
- **Risveglio**: il server gratuito di Render dorme dopo 15 minuti di silenzio.
  L'app non se ne accorge (lavora sul dispositivo e sincronizza dopo), ma il
  primo accesso della giornata può impiegare un minuto. La sveglia automatica
  è in `docs/SERVER_ONLINE.md`, passo 5.
- **Notifiche**: arrivano mentre l'app è aperta o in sottofondo. Per gli
  appuntamenti importanti c'è il pulsante **Calendario Apple**.
