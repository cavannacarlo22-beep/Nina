// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { db, uid } from '../src/db/db';
import { __test, fromServer, toChange } from '../src/sync/engine';
import { blankTask, saveTask } from '../src/lib/tasks';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('conversioni verso e dal server', () => {
  it('le attività viaggiano con i nomi del server, senza i campi locali', async () => {
    const id = await saveTask(blankTask({ title: 'Latte', listId: 'l1' }));
    const row = await db.tasks.get(id);
    const c = toChange('tasks', row as never);
    expect(c.entity).toBe('tasks');
    expect(c.data).toMatchObject({ title: 'Latte', listId: 'l1', date: null, priority: 'MEDIUM' });
    expect(c.data).not.toHaveProperty('_dirty');
    expect(c.data).not.toHaveProperty('id');
  });

  it('quaderni e capitoli diventano documenti con la loro collezione', () => {
    const c = toChange('notes', { id: 'n1', title: 'Capitolo 1', content: { type: 'doc' }, _dirty: 1, _cu: 'x' } as never);
    expect(c).toMatchObject({ entity: 'documents', id: 'n1', data: { collection: 'notes', data: { title: 'Capitolo 1', content: { type: 'doc' } } } });
  });

  it('dal server: documenti, cancellazioni e collezioni sconosciute', () => {
    const doc = fromServer('documents', { id: 'a', collection: 'events', data: { title: 'Cena' }, deletedAt: null, clientUpdatedAt: '2026-01-01T00:00:00Z' });
    expect(doc?.table).toBe('events');
    expect(doc?.row).toMatchObject({ id: 'a', title: 'Cena', _dirty: 0 });
    expect(fromServer('documents', { id: 'b', collection: 'events', data: {}, deletedAt: '2026-01-01T00:00:00Z' })?.row).toBeNull();
    expect(fromServer('documents', { id: 'c', collection: 'sconosciuta', data: {} })).toBeNull();
    const task = fromServer('tasks', { id: 't', title: 'X', version: 3, syncSeq: 9, deletedAt: null, clientUpdatedAt: 'z' });
    expect(task?.row).not.toHaveProperty('syncSeq');
  });
});

describe('arrivo delle modifiche remote', () => {
  it('si applicano senza tornare indietro come modifiche da inviare', async () => {
    const id = uid();
    await __test.applyRemote([{ entity: 'tasks', data: { id, title: 'Dal telefono', date: null, isCompleted: false, deletedAt: null, clientUpdatedAt: '2026-01-01T00:00:00Z' } }]);
    expect((await db.tasks.get(id))?._dirty).toBe(0);
    expect(await __test.collectDirty()).toHaveLength(0);
  });

  it('una modifica locale più recente non viene sovrascritta', async () => {
    const id = await saveTask(blankTask({ title: 'Mia versione' }));
    await __test.applyRemote([{ entity: 'tasks', data: { id, title: 'Vecchia', deletedAt: null, clientUpdatedAt: '2000-01-01T00:00:00Z' } }]);
    expect((await db.tasks.get(id))?.title).toBe('Mia versione');
  });

  it('una cancellazione remota elimina anche il contenuto del file', async () => {
    await db.files.add({ id: 'f', name: 'a.pdf', folderId: null, mime: '', size: 1, category: 'pdf', favorite: false, tags: [], createdAt: 1, updatedAt: 1 });
    await db.fileBlobs.add({ id: 'f', blob: new Blob(['x']), uploaded: 1 });
    await __test.applyRemote([{ entity: 'documents', data: { id: 'f', collection: 'files', data: {}, deletedAt: '2030-01-01T00:00:00Z', clientUpdatedAt: '2030-01-01T00:00:00Z' } }]);
    expect(await db.files.get('f')).toBeUndefined();
    expect(await db.fileBlobs.get('f')).toBeUndefined();
  });
});
