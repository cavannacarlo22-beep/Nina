/**
 * La voce di Nina: i messaggi dell'app.
 *
 * Copiato dal copione dell'app iOS (VoceDiNina.swift), con le stesse regole:
 *  · si dà del tu, sempre;
 *  · non si dice mai "utente", "elemento", "operazione";
 *  · l'ironia serve ad alleggerire, mai a commentare un momento difficile;
 *  · nessun messaggio è colpevolizzante: le cose non fatte non sono colpe;
 *  · ogni categoria ha più varianti e non si ripete quella appena usata.
 */
import { QUOTES, type Quote } from './seed';

const ultime = new Map<string, string>();
function scegli(categoria: string, elenco: string[]): string {
  if (elenco.length <= 1) return elenco[0] ?? '';
  const disponibili = elenco.filter((f) => f !== ultime.get(categoria));
  const scelta = disponibili[Math.floor(Math.random() * disponibili.length)] ?? elenco[0];
  ultime.set(categoria, scelta);
  return scelta;
}

/** Saluto stabile durante l'ora (non cambia a ogni secondo dell'orologio). */
const salutiCache = new Map<string, string>();
export function saluto(nome: string, ora = new Date().getHours()): string {
  const chiave = `${nome}|${ora}`;
  const c = salutiCache.get(chiave);
  if (c) return c;
  const n = nome || 'tu';
  let frase: string;
  if (ora >= 5 && ora < 11) frase = scegli('mattina', [`Buongiorno, ${n} 🌸`, `Ciao ${n}! Si parte 🌤️`, 'Buongiorno 💗 Come si comincia oggi?', `Eccoti. Buongiorno, ${n}`, `Nuovo giorno, ${n} ☀️`]);
  else if (ora >= 11 && ora < 14) frase = scegli('mezzogiorno', [`Ciao ${n}!`, `Buon pomeriggio, ${n} 🌼`, `Come sta andando, ${n}?`, `Ehi ${n} 💗`]);
  else if (ora >= 14 && ora < 19) frase = scegli('pomeriggio', [`Ciao ${n} 🌷`, 'Buon pomeriggio!', `Ehi ${n}, come va?`, `Bentornata, ${n}`]);
  else if (ora >= 19 && ora < 23) frase = scegli('sera', [`Buonasera, ${n} 🌙`, `Ciao ${n}, com'è andata?`, `Sera, ${n} ✨`, 'Eccoti. Serata tranquilla?']);
  else frase = scegli('notte', [`Ancora sveglia, ${n}? 🌙`, `Ciao ${n}. È tardi, eh?`, `Notte fonda, ${n} ✨`]);
  if (!nome) frase = frase.replace(/,? tu\b/, '').replace(/ tu!/, '!');
  salutiCache.set(chiave, frase);
  return frase;
}

export const attivitaFatta = () => scegli('fatta', ['Fatta! Una cosa in meno 😌', 'Brava! Questa era importante.', 'Ecco, così 💗', 'Una in meno. Continua così.', 'Bene! Tolta di mezzo 😄', 'Perfetto. Avanti la prossima.', 'Fatto ✨', "Questa se n'è andata 😌", 'Bravissima.', 'E anche questa è sistemata.']);

export const tutteFatte = () => scegli('tutteFatte', ["CE L'ABBIAMO FATTA! 🎉", 'Tutto fatto. Direi che puoi rilassarti 😌', 'Lista vuota. Che bella sensazione 💗', 'Non è rimasto niente. Brava davvero.', 'Finito tutto! Adesso pausa vera.', 'Zero cose in sospeso. Goditela 🎉']);

export function rimaste(q: number): string {
  if (q === 1) return scegli('rimaste1', ['Ne manca una sola 💪', 'Ancora una cosina e abbiamo finito.', "Manca l'ultima!"]);
  if (q <= 3) return scegli('rimastePoche', [`Abbiamo ancora ${q} cosine da sistemare 👀`, `Ne restano ${q}. Ce la facciamo.`, `${q} cose e poi basta 💗`]);
  return scegli('rimasteTante', [`Ci sono ${q} cose oggi. Una alla volta 😌`, `${q} da fare. Non tutte adesso, eh.`, 'Oggi la lista è lunga. Partiamo dalla prima.']);
}

export const attivitaScaduta = () => scegli('scaduta', ['Ops 😅 questa ci è scappata.', 'Questa è rimasta indietro. Capita.', 'Ci è sfuggita. La spostiamo?', 'Rimasta lì. Vuoi rimandarla a domani?', 'Questa è scappata via 😌']);

export function streak(g: number): string {
  if (g === 0) return scegli('streak0', ['Si comincia oggi 💗', 'Primo giorno. Da qualche parte si parte.']);
  if (g === 1) return 'Primo giorno fatto 🔥';
  if (g <= 6) return scegli('streakPochi', [`${g} giorni di fila 🔥`, `${g} giorni! Sta diventando un'abitudine.`]);
  if (g <= 20) return scegli('streakMedi', [`${g} giorni consecutivi 🔥 Che costanza`, `${g} giorni. Ormai è tua.`]);
  return scegli('streakTanti', [`${g} giorni 🔥🔥 Sei una macchina`, `${g} giorni di fila. Rispetto.`]);
}

export const streakInterrotto = () => scegli('streakRotto', ['Tranquilla. Non hai perso tutto. Si riparte oggi 💗', 'Un giorno saltato non cancella quelli prima.', 'Va bene. Ricominciamo da qui, senza drammi.', 'Capita a tutte. Oggi è un buon giorno per riprendere.']);

export const moodPositivo = () => scegli('moodBuono', ['Che bello leggerlo 💗', 'Mi fa piacere davvero.', 'Ottimo! Segnatelo, questo giorno.', 'Evvai 😄', 'Bene così ✨']);
export const moodDifficile = () => scegli('moodBrutto', ['Va bene anche così. Non devi stare bene per forza 💗', 'Grazie di avermelo detto. Ci sono.', 'Giornate così capitano. Passa.', 'Mi dispiace. Sii gentile con te oggi.', 'Ok. Oggi facciamo il minimo, va benissimo.']);

export function riepilogoSera(completate: number, restano: number): string {
  if (completate === 0 && restano === 0) return scegli('seraVuota', ['Giornata senza programmi. Ci sta 😌', 'Oggi niente lista. Va bene anche così.']);
  if (restano === 0) return scegli('seraTutto', ['Direi che oggi abbiamo dato abbastanza. Ora relax 😌', 'Tutto fatto. Te lo sei meritato il divano.', 'Giornata piena e chiusa bene 💗']);
  if (completate === 0) return scegli('seraNiente', ['Oggi non è andata come volevamo. Pazienza, domani ci riproviamo ❤️', 'Giornata storta? Capita. Domani è un altro giro.', 'Va bene. Non tutti i giorni sono produttivi, e non devono esserlo.']);
  return scegli('seraMista', [`${completate} fatte, ${restano} rimaste. Direi che va bene così 😌`, `Ne hai fatte ${completate}. Il resto aspetta domani.`, `Buon lavoro oggi. Le ${restano} rimaste non scappano.`]);
}

export const inviteSelfCare = () => scegli('selfCare', ["Ti sei presa cinque minuti oggi?", "Quando è stata l'ultima volta che hai fatto qualcosa solo per te?", 'Piccola pausa? Te la meriti 💗', 'Respira. Non devi fare tutto contemporaneamente 😂', "Anche solo un bicchiere d'acqua conta."]);
export const incoraggiamento = () => scegli('incoraggiamento', ['Ok bestie, una cosa alla volta.', 'Non devi fare tutto oggi.', 'Piano piano si arriva lo stesso.', 'Sei più avanti di quanto pensi.', 'Anche i piccoli passi sono passi 💗', 'Fatto è meglio di perfetto.']);
export const nienteAttivitaOggi = () => scegli('vuotoAttivita', ['Oggi è libero! Aggiungi qualcosa se ti va 💗', 'Nessun programma. Che lusso 😌', 'Giornata vuota. La riempiamo o la lasciamo così?']);
export const nienteAbitudini = () => "Le abitudini si costruiscono una alla volta. Ne aggiungiamo una?";
export const nienteDiario = () => 'Il diario è tuo e solo tuo. Nessuno lo legge, nemmeno io.';
export const nienteWishlist = () => 'Cosa ti piacerebbe avere? Anche solo per guardarlo ✨';
export const nienteNote = () => 'Le cose da ricordare finiscono qui, prima di dimenticarle.';
export const erroreGentile = () => scegli('errore', ['Qualcosa è andato storto 😅 Riproviamo tra un secondo.', 'Ops. Non ha funzionato. Riprova?', "Mmh, non è andata. Ci riproviamo?"]);
export const offline = () => scegli('offline', ["Non c'è rete, ma tranquilla: salvo tutto qui e sincronizzo dopo 💗", 'Sei offline. Continua pure, penso io a mandare tutto quando torna la linea.']);

/** Il pensiero del giorno: stabile per tutta la giornata, diverso da ieri. */
export function pensieroDelGiorno(date = new Date()): Quote {
  const start = new Date(date.getFullYear(), 0, 0).getTime();
  const day = Math.floor((date.getTime() - start) / 86400000) + date.getFullYear() * 7;
  return QUOTES[day % QUOTES.length];
}
