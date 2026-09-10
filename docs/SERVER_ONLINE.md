# Mettere il backend online

Finché il backend gira su un computer, Nina funziona solo finché quel computer
è acceso. Questa pagina lo sposta su un server che sta sempre lì, non costa
niente e non richiede più nessun Mac.

Serve una volta sola. Dopo, gli aggiornamenti partono da soli.

---

## Prima: da dove viene la stringa del database

L'unica cosa da incollare a mano è la stringa di connessione a Neon — la
stessa che avevi usato con `avvia.sh`. Se non ce l'hai più sottomano:

1. vai su **neon.tech** e accedi;
2. apri il progetto **nina**;
3. **Connection Details** → copia la stringa che comincia con
   `postgresql://` (scegli quella **Pooled**).

Non incollarla in una chat, non mandarla per email, non scriverla in un file
del progetto. Va solo dentro il modulo di Render del passo 3.

---

## Passo 1 — Crea l'account Render

Su **render.com** → *Get Started* → accedi **con GitHub**.

Non serve la carta di credito. Il piano che useremo è gratuito.

## Passo 2 — Collega il progetto

Dalla dashboard: **New +** → **Blueprint**.

Render chiede quale repository usare: scegli **Nina**. Trova da solo il file
`render.yaml` e capisce cosa costruire — non c'è niente da configurare.

## Passo 3 — Incolla la stringa del database

Render mostra un modulo con un campo solo: **DATABASE_URL**.

Incolla lì la stringa di Neon e conferma (**Apply** / **Create**).

Gli altri valori li genera lui: i due segreti che firmano le sessioni vengono
creati a caso e non li vede nessuno, nemmeno tu. È voluto — un segreto che
nessun essere umano digita è un segreto che nessuno può riusare per sbaglio.

La prima costruzione richiede cinque o dieci minuti. Alla fine il servizio
diventa **Live** e in alto compare il suo indirizzo, qualcosa come:

```
https://nina-backend-xxxx.onrender.com
```

**Quell'indirizzo serve.** Copialo e mandamelo: lo devo scrivere dentro l'app.

## Passo 4 — Registra il tuo account, poi richiudi

Il server nasce con **le registrazioni chiuse**: chiunque trovi l'indirizzo
non può farci niente. Ma il primo account devi ancora crearlo, quindi la porta
va aperta per qualche minuto.

Su Render, dentro il servizio: **Environment** → trova `REGISTRAZIONI_APERTE`.

1. cambia il valore da `no` a `si` → **Save**;
2. aspetta il riavvio (un minuto);
3. **apri Nina sul telefono e registrati**;
4. torna su Render e rimetti `no` → **Save**.

Da quel momento la porta è di nuovo chiusa e il tuo account continua a
funzionare. Ogni volta che servirà un account nuovo si ripete: aprire,
registrare, richiudere.

## Passo 5 — Non farlo addormentare

Il piano gratuito spegne il servizio dopo 15 minuti di silenzio, e riaccenderlo
richiede circa un minuto. Per evitarlo c'è già una sveglia automatica nel
repository: le manca solo l'indirizzo.

Su **GitHub → il repository Nina → Settings → Secrets and variables →
Actions → Variables → New repository variable**:

- **Name**: `NINA_HEALTH_URL`
- **Value**: l'indirizzo del passo 3 con `/health` in fondo, per esempio
  `https://nina-backend-xxxx.onrender.com/health`

Fatto. Da lì in poi il server resta sveglio dalle 6 alle 23 e dorme di notte.

---

## Cosa è chiuso, e perché

Il server sta su internet — deve, altrimenti il telefono non lo
raggiungerebbe. Quello che si può togliere è la possibilità di **farci
qualcosa**, e infatti:

| | |
|---|---|
| **Registrazioni** | chiuse. Chi trova l'indirizzo non può crearsi un account. |
| **Documentazione dell'API** | spenta in produzione. Chi arriva non trova l'elenco di cosa esiste. |
| **Origini browser** | nessuna autorizzata. Nessuna pagina web può parlare col server. |
| **Password** | mai salvate. Solo un'impronta Argon2id, da cui non si torna indietro. |
| **Tentativi di accesso** | limitati. Provare password a raffica non porta da nessuna parte. |
| **Diari e umori** | leggibili solo dal tuo account. Nemmeno l'ADMIN li vede. |
| **Segreti** | vivono solo su Render. Non stanno nel repository, non stanno nell'app. |

Quello che resta possibile a un estraneo è bussare e sentirsi rispondere «no».

## Se qualcosa non torna

**Il servizio resta "Deploy failed".** Apri **Logs**: quasi sempre è la
stringa del database sbagliata o incompleta. Deve finire con `?sslmode=require`.

**L'app dice che non riesce a raggiungere il server.** Prova ad aprire
l'indirizzo con `/health` in fondo dal browser del telefono: se risponde,
il problema è l'indirizzo scritto nell'app e va rifatto il pacchetto; se non
risponde, il server è giù.

**Non riesco a registrarmi: «Le registrazioni sono chiuse».** È il passo 4:
la porta è chiusa. Aprila, registrati, richiudila.
