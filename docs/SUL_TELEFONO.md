# Mettere Nina sul telefono

Nina non passa dall'App Store. Ci arriva per la strada che Apple lascia aperta
a chi scrive app per sé: si installa dal proprio computer, firmata con il
proprio Apple ID. È legale, non richiede modifiche al telefono e non costa
niente.

Il computer serve **una volta sola**, all'inizio. Dopo, gli aggiornamenti
arrivano da soli e si installano con un tocco dal telefono.

---

## Cosa ti serve

- il tuo **iPhone**
- un **PC Windows** e il **cavo** del telefono
- il tuo **Apple ID** — quello normale, gratuito. Non serve nessun abbonamento.

Il Mac non serve. Non è mai più servito da quando la compilazione la fa
GitHub.

---

## Prima parte — preparare il PC (una volta sola)

### 1. Fai parlare Windows con l'iPhone

Installa **iTunes** dal sito di Apple — **non** dalla versione del Microsoft
Store, che non contiene i driver.

Non lo userai mai direttamente: serve solo perché Windows riconosca un iPhone
collegato. Senza, il resto non funziona e l'errore che esce non lo dice.

### 2. Collega il telefono

Cavo, telefono sbloccato. Se compare **«Autorizzare questo computer?»** →
**Autorizza**, e digita il codice del telefono.

### 3. Installa SideStore

SideStore è un'app che vive **sul telefono**. Il PC serve solo da trampolino,
questa volta e mai più.

Due cose, dal PC, seguendo le istruzioni su **sidestore.io**:

1. **il file di aggancio** — si crea con lo strumento `idevice_pair` (in
   alcune guide si chiama JitterbugPair). Telefono collegato, sbloccato, sulla
   schermata Home;
2. **SideStore sul telefono** — la prima installazione parte dal PC.

⚠️ Quando sposti il file `.mobiledevicepairing` dal PC al telefono, Windows
tende a cambiargli l'estensione e SideStore poi lo rifiuta senza spiegare
perché. **Mettilo in uno zip prima di trasferirlo.**

Ti chiederà **l'Apple ID e la password**. È il passaggio che mette a disagio,
quindi vale la pena spiegarlo: quelle credenziali servono a chiedere ad Apple
un certificato di sviluppo intestato a te — è la stessa cosa che fa Xcode su
un Mac. Se vuoi dormire tranquilla, crea un Apple ID nuovo e usa quello solo
per questo: funziona identico.

Da qui in avanti il PC non serve più. È il motivo per cui SideStore è
preferibile ad AltStore: AltStore pretende che il computer resti installato e
acceso per rinnovare le app ogni settimana, SideStore si rinnova da solo sul
telefono.

### 4. Autorizza il certificato sul telefono

**Impostazioni → Generali → VPN e gestione dispositivo →** tocca il tuo Apple
ID **→ Autorizza**.

Senza questo passo l'app si installa ma non si apre, e il messaggio d'errore
non spiega perché.

---

## Seconda parte — installare Nina

### 5. Aggiungi la sorgente

Apri **SideStore → Browse → Sources → +** e incolla:

```
https://raw.githubusercontent.com/cavannacarlo22-beep/Nina/main/sorgente.json
```

Comparirà una sorgente chiamata **Nina** con dentro una sola app.

### 6. Installa

Aprila e tocca **Install** (o **Free**). Un minuto, e Nina è sulla schermata
Home.

### 7. Fatti l'account

Il server nasce con le registrazioni chiuse — chi trova l'indirizzo non può
farci niente. Per creare il **tuo** account la porta va aperta due minuti:

1. **render.com** → servizio `nina-backend` → **Environment**
2. `REGISTRAZIONI_APERTE`: da `no` a `si` → **Save**, aspetta il riavvio
3. **apri Nina e registrati**
4. torna su Render, rimetti `no` → **Save**

Da lì in avanti la porta è chiusa e il tuo account continua a funzionare.

---

## Gli aggiornamenti

Quando cambia qualcosa nel codice, un Mac di GitHub ricostruisce il pacchetto
da solo e aggiorna la sorgente. Sul telefono:

**SideStore → My Apps →** accanto a Nina compare **Update**. Un tocco.

Nessun computer, nessun cavo, nessun Mac.

---

## La scadenza dei 7 giorni

Apple fa scadere le firme degli Apple ID gratuiti **dopo una settimana**.
Quando succede, Nina non si apre più finché non viene rifirmata.

SideStore lo fa da solo via Wi-Fi, ma è la parte più fragile di tutta la
catena. Se un giorno l'app non parte:

**apri SideStore → My Apps → Refresh accanto a Nina.**

Quindici secondi e torna a funzionare. I tuoi dati non si toccano: restano nel
telefono e sul server.

Se il rinnovo automatico non funziona mai, l'unico modo per toglierlo di mezzo
è l'abbonamento sviluppatore di Apple (99 € l'anno), che porta la scadenza a
un anno. Non serve per nient'altro.

---

## Perché mancano i widget

I widget leggono i dati dell'app attraverso un **App Group**, e Apple non
concede gli App Group agli Apple ID gratuiti. Un pacchetto che ne chiede uno
viene rifiutato al momento della firma — quindi l'estensione dei widget è
tolta dal pacchetto.

Non è definitivo: un widget può prendersi i dati dal server invece che
dall'app. Richiede una riscrittura e un codice da incollare una volta nelle
impostazioni del widget. È il prossimo lavoro.

Tutto il resto dell'app c'è: impegni, calendario, diario, abitudini, lista dei
desideri, statistiche, l'amica con cui parlare.

---

## Se qualcosa non va

**«Impossibile installare l'app».** Con un Apple ID gratuito si possono tenere
al massimo **tre** app installate per questa strada. Togline una.

**L'app si installa ma non si apre.** Manca il passo 4: autorizza il
certificato nelle Impostazioni.

**Nina si apre ma dice che non raggiunge il server.** Prova
`https://nina-backend-yeip.onrender.com/health` dal browser del telefono. Se
ci mette cinquanta secondi ed è la prima volta della giornata, è normale — il
piano gratuito lo aveva addormentato.

**«Le registrazioni sono chiuse».** È il passo 7: la porta è chiusa apposta.
Aprila, registrati, richiudila.
