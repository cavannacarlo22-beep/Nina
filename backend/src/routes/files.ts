// FILE: backend/src/routes/files.ts
//
// Il contenuto dei file dell'archivio (PDF, foto, documenti Word…).
//
// I metadati — nome, cartella, preferito — sono un documento della collezione
// "files" e viaggiano con la sincronizzazione. Il contenuto no: è pesante, non
// cambia quasi mai, e rimandarlo a ogni giro sarebbe uno spreco. Si carica una
// volta con PUT e ogni dispositivo lo scarica quando serve con GET.
//
// L'id è quello del documento, generato dal dispositivo: caricare due volte lo
// stesso file sovrascrive, non duplica.

import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { queryOne, sql } from '../db/sql.js';
import { AppError } from '../utils/errors.js';
import { Uuid } from './schemas.js';

/** Il file più grande che si può mettere nell'archivio. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const IdParam = Type.Object({ id: Uuid });

function cleanMime(value: unknown): string {
  const mime = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime) ? mime.slice(0, 120) : 'application/octet-stream';
}

export const fileRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('preHandler', requireAuth);

  // Il corpo arriva così com'è, byte per byte, qualunque sia il tipo.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: MAX_FILE_BYTES }, (_req, body, done) => {
    done(null, body);
  });

  app.put(
    '/:id',
    {
      bodyLimit: MAX_FILE_BYTES,
      schema: {
        tags: ['files'],
        summary: 'Carica il contenuto di un file dell\'archivio',
        description: 'Il tipo del file va nell\'header `X-Nina-File-Mime`. Massimo 25 MB.',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Type.Object({ id: Uuid, size: Type.Integer() }) },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const body = request.body as unknown;
      if (!Buffer.isBuffer(body)) throw AppError.validation('Il file è vuoto o illeggibile.');
      const mime = cleanMime(request.headers['x-nina-file-mime']);

      // Un id già usato da un'altra persona non si può sovrascrivere: l'UPDATE
      // del conflitto è filtrato per user_id e in quel caso non tocca niente.
      const row = await queryOne<{ id: string; size: number }>(
        sql`INSERT INTO file_blobs (id, user_id, mime, size, content)
            VALUES (${request.params.id}, ${userId}, ${mime}, ${body.length}, ${body})
            ON CONFLICT (id) DO UPDATE
               SET mime = EXCLUDED.mime, size = EXCLUDED.size, content = EXCLUDED.content
             WHERE file_blobs.user_id = EXCLUDED.user_id
            RETURNING id, size`,
      );
      if (!row) throw AppError.notFound();
      return row;
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['files'],
        summary: 'Scarica il contenuto di un file dell\'archivio',
        security: [{ bearerAuth: [] }],
        params: IdParam,
      },
    },
    async (request, reply) => {
      const userId = currentUserId(request);
      const row = await queryOne<{ mime: string; content: Buffer }>(
        sql`SELECT mime, content FROM file_blobs WHERE id = ${request.params.id} AND user_id = ${userId}`,
      );
      if (!row) throw AppError.notFound();
      return reply
        .header('Content-Type', row.mime)
        .header('Cache-Control', 'private, max-age=31536000, immutable')
        .send(row.content);
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['files'],
        summary: 'Elimina il contenuto di un file dell\'archivio',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Type.Object({ ok: Type.Boolean() }) },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      await queryOne(sql`DELETE FROM file_blobs WHERE id = ${request.params.id} AND user_id = ${userId} RETURNING id`);
      return { ok: true };
    },
  );
};
