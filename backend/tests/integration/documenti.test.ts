// FILE: backend/tests/integration/documenti.test.ts
//
// Quaderni, appuntamenti, cartelle e file: tutto ciò che Nina custodisce oltre
// alle attività. Viaggia nella tabella `documents` con la stessa
// sincronizzazione di tutto il resto, e i file hanno le loro rotte.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { avviaApp, chiama, registra, ricreaSchema, type Sessione } from './aiuto.js';
import { pool } from '../../src/db/pool.js';

let app: FastifyInstance;
let ada: Sessione;
let bea: Sessione;

const IPAD = 'ipad-di-prova';
const IPHONE = 'iphone-di-prova';

beforeAll(async () => {
  await ricreaSchema();
  app = await avviaApp();
  ada = await registra(app, { device: IPAD });
  bea = await registra(app, { device: 'altro-dispositivo-01' });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

const adesso = (ms = 0) => new Date(Date.now() + ms).toISOString();

describe('documenti sincronizzati', () => {
  it('un capitolo scritto sull\'iPad arriva sull\'iPhone, contenuto compreso', async () => {
    const id = randomUUID();
    const capitolo = { notebookId: randomUUID(), title: 'La varianza', content: { type: 'doc', content: [] }, text: 'misura la dispersione' };

    const push = await chiama(app, ada, 'POST', '/sync/push', {
      changes: [{ entity: 'documents', id, clientUpdatedAt: adesso(), data: { collection: 'notes', data: capitolo } }],
    }, IPAD);
    expect(push.statusCode).toBe(200);
    expect(push.json().results[0].outcome).toBe('applied');

    const pull = await chiama(app, ada, 'GET', '/sync/changes?since=0', undefined, IPHONE);
    const arrivato = pull.json().changes.find((c: { data: { id: string } }) => c.data.id === id);
    expect(arrivato.entity).toBe('documents');
    expect(arrivato.data.collection).toBe('notes');
    expect(arrivato.data.data).toEqual(capitolo);
  });

  it('vale la regola dei conflitti: vince la modifica più recente', async () => {
    const id = randomUUID();
    await chiama(app, ada, 'POST', '/sync/push', {
      changes: [{ entity: 'documents', id, clientUpdatedAt: adesso(), data: { collection: 'events', data: { title: 'Dentista' } } }],
    }, IPAD);
    const vecchia = await chiama(app, ada, 'POST', '/sync/push', {
      changes: [{ entity: 'documents', id, clientUpdatedAt: adesso(-60_000), data: { data: { title: 'Vecchio' } } }],
    }, IPHONE);
    expect(vecchia.json().results[0].outcome).toBe('rejected');
    expect(vecchia.json().results[0].server.data.title).toBe('Dentista');
  });

  it('la cancellazione viaggia e vince', async () => {
    const id = randomUUID();
    await chiama(app, ada, 'POST', '/sync/push', {
      changes: [{ entity: 'documents', id, clientUpdatedAt: adesso(), data: { collection: 'folders', data: { name: 'Ricette' } } }],
    }, IPAD);
    const via = await chiama(app, ada, 'POST', '/sync/push', {
      changes: [{ entity: 'documents', id, clientUpdatedAt: adesso(1000), data: { deletedAt: adesso(1000) } }],
    }, IPAD);
    expect(via.json().results[0].server.deletedAt).not.toBeNull();
  });

  it('una collezione con un nome strano viene rifiutata, il resto del lotto entra', async () => {
    const buona = randomUUID();
    const r = await chiama(app, ada, 'POST', '/sync/push', {
      changes: [
        { entity: 'documents', id: randomUUID(), clientUpdatedAt: adesso(), data: { collection: 'drop table;', data: {} } },
        { entity: 'documents', id: buona, clientUpdatedAt: adesso(), data: { collection: 'sheets', data: { name: 'Spese' } } },
      ],
    }, IPAD);
    expect(r.json().results.map((x: { outcome: string }) => x.outcome)).toEqual(['rejected', 'applied']);
  });

  it('i documenti di Ada non arrivano a Bea', async () => {
    const pull = await chiama(app, bea, 'GET', '/sync/changes?since=0', undefined, 'altro-dispositivo-01');
    expect(pull.json().changes.filter((c: { entity: string }) => c.entity === 'documents')).toHaveLength(0);
  });

  it('con tanti documenti la lettura a pagine non ne salta nessuno', async () => {
    const utente = await registra(app, { device: IPAD });
    const ids: string[] = [];
    // documenti e attività mescolati, più di una pagina
    for (let lotto = 0; lotto < 3; lotto++) {
      const changes = [];
      for (let i = 0; i < 30; i++) {
        const id = randomUUID();
        ids.push(id);
        changes.push({ entity: 'documents', id, clientUpdatedAt: adesso(), data: { collection: 'notes', data: { n: lotto * 100 + i } } });
        const t = randomUUID();
        ids.push(t);
        changes.push({ entity: 'tasks', id: t, clientUpdatedAt: adesso(), data: { title: `cosa ${i}`, date: null, listId: randomUUID() } });
      }
      await chiama(app, utente, 'POST', '/sync/push', { changes }, IPAD);
    }
    const visti = new Set<string>();
    let cursore = 0;
    for (let giri = 0; giri < 20; giri++) {
      const r = (await chiama(app, utente, 'GET', `/sync/changes?since=${cursore}&limit=50`, undefined, IPHONE)).json();
      for (const c of r.changes) visti.add(c.data.id);
      cursore = r.cursor;
      if (!r.hasMore) break;
    }
    for (const id of ids) expect(visti.has(id)).toBe(true);
  });
});

describe('attività nelle liste', () => {
  it('una voce della lista della spesa può non avere un giorno', async () => {
    const lista = randomUUID();
    const id = randomUUID();
    const r = await chiama(app, ada, 'POST', '/sync/push', {
      changes: [{ entity: 'tasks', id, clientUpdatedAt: adesso(), data: { title: 'Latte', date: null, listId: lista, sortOrder: 3 } }],
    }, IPAD);
    expect(r.json().results[0].outcome).toBe('applied');
    expect(r.json().results[0].server).toMatchObject({ date: null, listId: lista, sortOrder: 3 });
  });

  it('ma una ripetizione senza giorno non ha senso e viene rifiutata', async () => {
    const r = await chiama(app, ada, 'POST', '/sync/push', {
      changes: [{ entity: 'tasks', id: randomUUID(), clientUpdatedAt: adesso(), data: { title: 'Palestra', date: null, repeatType: 'DAILY' } }],
    }, IPAD);
    expect(r.json().results[0].outcome).toBe('rejected');
  });

  it('le rotte REST delle attività funzionano anche con voci senza giorno', async () => {
    const r = await chiama(app, ada, 'GET', '/tasks', undefined, IPAD);
    expect(r.statusCode).toBe(200);
  });
});

describe('file dell\'archivio', () => {
  const contenuto = Buffer.from('%PDF-1.4 un pdf finto ma di byte veri\n');

  async function carica(chi: Sessione, id: string) {
    return app.inject({
      method: 'PUT', url: `/files/${id}`,
      headers: { authorization: `Bearer ${chi.token}`, 'content-type': 'application/octet-stream', 'x-nina-file-mime': 'application/pdf' },
      payload: contenuto,
    });
  }

  it('si carica e si riscarica identico', async () => {
    const id = randomUUID();
    const su = await carica(ada, id);
    expect(su.statusCode).toBe(200);
    expect(su.json().size).toBe(contenuto.length);

    const giu = await app.inject({ method: 'GET', url: `/files/${id}`, headers: { authorization: `Bearer ${ada.token}` } });
    expect(giu.statusCode).toBe(200);
    expect(giu.headers['content-type']).toContain('application/pdf');
    expect(giu.rawPayload.equals(contenuto)).toBe(true);
  });

  it('nessuno può leggere o sovrascrivere i file di un\'altra persona', async () => {
    const id = randomUUID();
    await carica(ada, id);
    const leggi = await app.inject({ method: 'GET', url: `/files/${id}`, headers: { authorization: `Bearer ${bea.token}` } });
    expect(leggi.statusCode).toBe(404);
    const scrivi = await carica(bea, id);
    expect(scrivi.statusCode).toBe(404);
    const ancora = await app.inject({ method: 'GET', url: `/files/${id}`, headers: { authorization: `Bearer ${ada.token}` } });
    expect(ancora.rawPayload.equals(contenuto)).toBe(true);
  });

  it('senza accesso non si carica niente', async () => {
    const r = await app.inject({ method: 'PUT', url: `/files/${randomUUID()}`, headers: { 'content-type': 'application/octet-stream' }, payload: contenuto });
    expect(r.statusCode).toBe(401);
  });

  it('si può eliminare', async () => {
    const id = randomUUID();
    await carica(ada, id);
    const del = await app.inject({ method: 'DELETE', url: `/files/${id}`, headers: { authorization: `Bearer ${ada.token}` } });
    expect(del.statusCode).toBe(200);
    const giu = await app.inject({ method: 'GET', url: `/files/${id}`, headers: { authorization: `Bearer ${ada.token}` } });
    expect(giu.statusCode).toBe(404);
  });
});

describe('app web (browser)', () => {
  it('lo stream in tempo reale porta le intestazioni CORS, altrimenti il browser lo rifiuta', async () => {
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const ctrl = new AbortController();
    const res = await fetch(`${address}/sync/stream`, {
      headers: { authorization: `Bearer ${ada.token}`, origin: 'https://app.nina.test', 'x-nina-device-id': IPAD },
      signal: ctrl.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.nina.test');
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    ctrl.abort();
  });

  it('il caricamento dei file accetta l\'intestazione del tipo da un\'altra origine', async () => {
    const r = await app.inject({
      method: 'OPTIONS', url: `/files/${randomUUID()}`,
      headers: { origin: 'https://app.nina.test', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'authorization,content-type,x-nina-file-mime' },
    });
    expect(r.statusCode).toBeLessThan(300);
    expect(String(r.headers['access-control-allow-headers']).toLowerCase()).toContain('x-nina-file-mime');
  });
});
