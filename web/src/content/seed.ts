/** Contenuti di Nina (gli stessi del server), disponibili anche offline. */

export interface Quote { text: string; author: string | null }
export interface SelfCareIdea { title: string; description: string; category: string; minutes: number }

export const QUOTES: Quote[] = [
 {
  "text": "Non devi fare tutto oggi. Devi solo fare qualcosa.",
  "author": null
 },
 {
  "text": "Una cosa alla volta. Poi un'altra. È così che si fanno le cose grandi.",
  "author": null
 },
 {
  "text": "Anche i giorni storti contano. Contano come giorni in cui ci hai provato.",
  "author": null
 },
 {
  "text": "Sei più avanti di quanto pensi. Ti sei solo dimenticata di guardare indietro.",
  "author": null
 },
 {
  "text": "Il riposo non è un premio che devi meritarti. È parte del lavoro.",
  "author": null
 },
 {
  "text": "Fatto è meglio di perfetto. Sempre.",
  "author": null
 },
 {
  "text": "Se oggi riesci solo a respirare, va bene. È già qualcosa.",
  "author": null
 },
 {
  "text": "Nessuno ha la vita che sembra avere su Instagram. Nemmeno chi la posta.",
  "author": null
 },
 {
  "text": "Puoi cambiare idea. Non è incoerenza, è crescere.",
  "author": null
 },
 {
  "text": "Le cose che rimandi da tre settimane probabilmente durano dieci minuti.",
  "author": null
 },
 {
  "text": "Chiedere aiuto non toglie niente a quello che sai fare da sola.",
  "author": null
 },
 {
  "text": "Oggi va bene anche il minimo indispensabile.",
  "author": null
 },
 {
  "text": "Il confronto è il modo più veloce per rovinarsi una giornata buona.",
  "author": null
 },
 {
  "text": "Non sei in ritardo. Non esiste un orario.",
  "author": null
 },
 {
  "text": "Le giornate storte finiscono. Questa è una promessa matematica.",
  "author": null
 },
 {
  "text": "Puoi essere stanca e forte contemporaneamente. Non è una contraddizione.",
  "author": null
 },
 {
  "text": "Fai la cosa che stai evitando. Dopo starai molto meglio, lo sai.",
  "author": null
 },
 {
  "text": "Va bene dire di no. Anche senza spiegare perché.",
  "author": null
 },
 {
  "text": "Il tuo valore non si misura in cose barrate da una lista.",
  "author": null
 },
 {
  "text": "Bevi un bicchiere d'acqua. Sul serio, adesso.",
  "author": null
 },
 {
  "text": "Se ci pensi da tanto, forse non è un'idea passeggera.",
  "author": null
 },
 {
  "text": "I progressi lenti sono comunque progressi.",
  "author": null
 },
 {
  "text": "Non devi essere motivata per iniziare. La motivazione arriva dopo, di solito.",
  "author": null
 },
 {
  "text": "Perdonati per ieri. Ieri non c'è più.",
  "author": null
 },
 {
  "text": "La tua versione stanca merita gentilezza quanto la tua versione produttiva.",
  "author": null
 },
 {
  "text": "Cinque minuti di ordine cambiano l'umore di un'intera stanza.",
  "author": null
 },
 {
  "text": "Non tutto quello che conta si può misurare.",
  "author": null
 },
 {
  "text": "Hai già superato il 100% dei tuoi giorni peggiori.",
  "author": null
 },
 {
  "text": "Fai qualcosa oggi di cui domani sarai contenta.",
  "author": null
 },
 {
  "text": "Se la lista è troppo lunga, il problema è la lista, non tu.",
  "author": null
 },
 {
  "text": "Il buonumore si allena come tutto il resto.",
  "author": null
 },
 {
  "text": "Va bene anche fermarsi a metà. Riprendere è permesso.",
  "author": null
 },
 {
  "text": "Le abitudini piccole battono i propositi enormi. Ogni volta.",
  "author": null
 },
 {
  "text": "Sii la persona che saresti voluta avere accanto quando stavi male.",
  "author": null
 },
 {
  "text": "Non esiste una versione di te che vada bene a tutti. Menomale.",
  "author": null
 },
 {
  "text": "Oggi è un buon giorno per essere gentile con te stessa.",
  "author": null
 },
 {
  "text": "Il tempo che ti prendi non è tempo rubato a nessuno.",
  "author": null
 },
 {
  "text": "Un passo indietro a volte è solo la rincorsa.",
  "author": null
 },
 {
  "text": "Smetti di rileggere quel messaggio. Va bene com'è.",
  "author": null
 },
 {
  "text": "Le cose belle richiedono tempo. Anche tu sei una cosa bella.",
  "author": null
 },
 {
  "text": "Non è che abbiamo poco tempo: è che ne perdiamo molto.",
  "author": "Seneca"
 },
 {
  "text": "Ogni giorno è una vita in miniatura.",
  "author": "Seneca"
 },
 {
  "text": "La felicità della tua vita dipende dalla qualità dei tuoi pensieri.",
  "author": "Marco Aurelio"
 },
 {
  "text": "Comincia: l'inizio è metà dell'opera.",
  "author": "Marco Aurelio"
 },
 {
  "text": "Non sono le cose a turbarci, ma le opinioni che ne abbiamo.",
  "author": "Epitteto"
 },
 {
  "text": "Non pretendere che le cose vadano come vuoi tu: accogli come vanno.",
  "author": "Epitteto"
 },
 {
  "text": "Non importa quanto vai piano, l'importante è non fermarsi.",
  "author": "Confucio"
 },
 {
  "text": "Un viaggio di mille miglia comincia con un solo passo.",
  "author": "Lao Tzu"
 },
 {
  "text": "Siamo ciò che facciamo ripetutamente. L'eccellenza è un'abitudine.",
  "author": "Aristotele"
 },
 {
  "text": "Il sapere è l'unica cosa che nessuno ti può togliere.",
  "author": "Socrate"
 },
 {
  "text": "Sii te stessa: gli altri sono già occupati.",
  "author": "Oscar Wilde"
 },
 {
  "text": "Vivi la vita che hai immaginato.",
  "author": "Henry David Thoreau"
 },
 {
  "text": "Niente di grande è mai stato fatto senza entusiasmo.",
  "author": "Ralph Waldo Emerson"
 },
 {
  "text": "Il segreto per andare avanti è cominciare.",
  "author": "Mark Twain"
 },
 {
  "text": "Non temo le tempeste: sto imparando a governare la mia nave.",
  "author": "Louisa May Alcott"
 },
 {
  "text": "Nella vita non c'è nulla da temere, solo da capire.",
  "author": "Marie Curie"
 },
 {
  "text": "Una donna deve avere una stanza tutta per sé.",
  "author": "Virginia Woolf"
 },
 {
  "text": "La chiarezza si guadagna scrivendo, non pensando.",
  "author": null
 },
 {
  "text": "La semplicità è la massima raffinatezza.",
  "author": "Leonardo da Vinci"
 },
 {
  "text": "Chi ha un perché abbastanza forte sopporta quasi ogni come.",
  "author": "Friedrich Nietzsche"
 }
];

export const SELF_CARE: SelfCareIdea[] = [
 {
  "title": "Fai una passeggiata",
  "description": "Anche solo intorno all'isolato. Senza meta, senza contare i passi.",
  "category": "FUORI",
  "minutes": 20
 },
 {
  "title": "Metti la tua canzone preferita",
  "description": "Quella che ti fa alzare il volume. A tutto volume, se puoi.",
  "category": "MENTE",
  "minutes": 4
 },
 {
  "title": "Stacca il telefono per 30 minuti",
  "description": "Modalità aereo. Il mondo sopravvive, promesso.",
  "category": "DIGITALE",
  "minutes": 30
 },
 {
  "title": "Fatti una doccia lunga",
  "description": "Acqua calda, niente fretta, nessuno che ti aspetta.",
  "category": "CORPO",
  "minutes": 20
 },
 {
  "title": "Prenditi un caffè con calma",
  "description": "Seduta. Senza telefono. Solo tu e la tazza.",
  "category": "RELAX",
  "minutes": 15
 },
 {
  "title": "Scrivi tre cose belle di oggi",
  "description": "Anche minuscole. Soprattutto minuscole.",
  "category": "MENTE",
  "minutes": 5
 },
 {
  "title": "Cambia le lenzuola",
  "description": "Non c'è niente come dormire tra lenzuola pulite.",
  "category": "CASA",
  "minutes": 10
 },
 {
  "title": "Fai stretching per dieci minuti",
  "description": "Il corpo ti ringrazia, soprattutto la schiena.",
  "category": "CORPO",
  "minutes": 10
 },
 {
  "title": "Chiama una persona a cui tieni",
  "description": "Non messaggi. Proprio una chiamata.",
  "category": "SOCIAL",
  "minutes": 20
 },
 {
  "title": "Riordina una sola superficie",
  "description": "La scrivania, il comodino, il tavolo. Una sola.",
  "category": "CASA",
  "minutes": 10
 },
 {
  "title": "Bevi un bicchiere d'acqua",
  "description": "Il gesto più sottovalutato della giornata.",
  "category": "CORPO",
  "minutes": 1
 },
 {
  "title": "Guarda fuori dalla finestra",
  "description": "Cinque minuti, senza fare altro. Si chiama riposo.",
  "category": "MENTE",
  "minutes": 5
 },
 {
  "title": "Fai una maschera viso",
  "description": "O anche solo una crema messa per bene.",
  "category": "CORPO",
  "minutes": 20
 },
 {
  "title": "Leggi dieci pagine",
  "description": "Di qualsiasi cosa, anche leggerissima.",
  "category": "MENTE",
  "minutes": 15
 },
 {
  "title": "Prepara qualcosa che ti piace",
  "description": "Cucinare per sé stesse non è mai tempo perso.",
  "category": "CASA",
  "minutes": 40
 },
 {
  "title": "Scrivi quello che ti gira in testa",
  "description": "Non deve avere senso. Deve solo uscire.",
  "category": "MENTE",
  "minutes": 15
 },
 {
  "title": "Fai un pisolino di venti minuti",
  "description": "Venti, non due ore. Metti la sveglia.",
  "category": "RELAX",
  "minutes": 20
 },
 {
  "title": "Cancella dieci foto inutili",
  "description": "Screenshot del 2021 che non servono più.",
  "category": "DIGITALE",
  "minutes": 5
 },
 {
  "title": "Accendi una candela",
  "description": "Cambia l'atmosfera di una stanza in tre secondi.",
  "category": "RELAX",
  "minutes": 2
 },
 {
  "title": "Balla in cucina",
  "description": "Da sola. Nessuno ti guarda.",
  "category": "CORPO",
  "minutes": 5
 },
 {
  "title": "Prendi aria dalla finestra",
  "description": "Due minuti di aria fredda resettano la testa.",
  "category": "FUORI",
  "minutes": 3
 },
 {
  "title": "Fai una lista di cose che aspetti",
  "description": "Anche piccole: una serie, una cena, un weekend.",
  "category": "MENTE",
  "minutes": 10
 },
 {
  "title": "Metti a posto la galleria",
  "description": "Elimina i doppioni. È stranamente soddisfacente.",
  "category": "DIGITALE",
  "minutes": 15
 },
 {
  "title": "Fai un bagno caldo",
  "description": "Con quello che ti piace dentro.",
  "category": "CORPO",
  "minutes": 40
 },
 {
  "title": "Disegna qualcosa di brutto",
  "description": "L'obiettivo non è il risultato.",
  "category": "CREATIVITA",
  "minutes": 15
 },
 {
  "title": "Riascolta un album intero",
  "description": "Dall'inizio alla fine, come si faceva una volta.",
  "category": "RELAX",
  "minutes": 45
 },
 {
  "title": "Scrivi a chi non senti da tanto",
  "description": "Un messaggio breve basta. Davvero.",
  "category": "SOCIAL",
  "minutes": 5
 },
 {
  "title": "Cambia posto ai mobili",
  "description": "Anche solo una poltrona. La stanza sembra nuova.",
  "category": "CASA",
  "minutes": 30
 },
 {
  "title": "Fai il letto",
  "description": "Se la giornata va male, almeno una cosa è fatta.",
  "category": "CASA",
  "minutes": 3
 },
 {
  "title": "Guarda un episodio senza sensi di colpa",
  "description": "Uno. Consapevolmente. Godendotelo.",
  "category": "RELAX",
  "minutes": 40
 },
 {
  "title": "Respira contando fino a quattro",
  "description": "Inspira 4, trattieni 4, espira 4. Dieci volte.",
  "category": "MENTE",
  "minutes": 5
 },
 {
  "title": "Metti in ordine le note del telefono",
  "description": "Quelle liste iniziate e mai finite.",
  "category": "DIGITALE",
  "minutes": 15
 },
 {
  "title": "Compra dei fiori",
  "description": "Anche il mazzo economico del supermercato.",
  "category": "FUORI",
  "minutes": 15
 },
 {
  "title": "Fai una cosa con le mani",
  "description": "Impastare, piantare, cucire, montare. Qualsiasi cosa.",
  "category": "CREATIVITA",
  "minutes": 30
 },
 {
  "title": "Silenzia le notifiche per un'ora",
  "description": "Non è maleducazione, è manutenzione.",
  "category": "DIGITALE",
  "minutes": 60
 },
 {
  "title": "Guarda vecchie foto belle",
  "description": "Quelle di un giorno in cui stavi bene.",
  "category": "MENTE",
  "minutes": 10
 },
 {
  "title": "Cammina senza cuffie",
  "description": "Sentire i rumori normali è più riposante di quanto sembri.",
  "category": "FUORI",
  "minutes": 20
 },
 {
  "title": "Scrivi una cosa di cui sei fiera",
  "description": "Di questa settimana. Ce n'è almeno una.",
  "category": "MENTE",
  "minutes": 5
 },
 {
  "title": "Prepara i vestiti per domani",
  "description": "La te di domani mattina ti ringrazierà.",
  "category": "CASA",
  "minutes": 5
 },
 {
  "title": "Non fare niente per dieci minuti",
  "description": "Seriamente niente. È più difficile di quanto sembra.",
  "category": "RELAX",
  "minutes": 10
 }
];
