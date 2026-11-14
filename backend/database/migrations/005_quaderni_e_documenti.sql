-- FILE: backend/database/migrations/005_quaderni_e_documenti.sql
-- Nina diventa anche un quaderno, un'agenda e un archivio.
--
-- 1. Le attività possono stare in una lista e non avere una data: "comprare il
--    latte" nella lista della spesa non ha un giorno, "consegnare il modulo"
--    sì. È la stessa cosa vista in due modi, quindi resta una tabella sola.
-- 2. Una tabella `documents` sincronizzata, generica: ogni riga ha una
--    `collection` (quaderni, capitoli, appuntamenti, cartelle…) e il contenuto
--    in JSONB. Il motore di sincronizzazione la tratta come tutte le altre:
--    stesso contatore, stessa regola dei conflitti, stesse cancellazioni.
--    Le funzioni che il server non deve interpretare vivono qui, così
--    aggiungerne una nuova nell'app non richiede una migration.
-- 3. `file_blobs`: il contenuto dei file dell'archivio. Non passa dalla
--    sincronizzazione (sarebbe troppo pesante da rimandare a ogni giro): si
--    carica e si scarica a parte, una volta sola, per id.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Attività nelle liste
-- ---------------------------------------------------------------------------

ALTER TABLE tasks ALTER COLUMN date DROP NOT NULL;
ALTER TABLE tasks ADD COLUMN list_id UUID;
ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Una ripetizione ha bisogno di un giorno da cui partire.
ALTER TABLE tasks ADD CONSTRAINT tasks_repeat_needs_date_chk
    CHECK (repeat_type = 'NEVER' OR date IS NOT NULL);

COMMENT ON COLUMN tasks.list_id IS
    'La lista a cui appartiene l''attività (un documento della collezione "lists"). NULL = nessuna lista.';
COMMENT ON COLUMN tasks.date IS
    'Il giorno dell''attività. NULL per le voci di una lista senza scadenza.';

CREATE INDEX tasks_user_list_idx ON tasks (user_id, list_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Documenti sincronizzati
-- ---------------------------------------------------------------------------

CREATE TABLE documents (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collection         TEXT NOT NULL,
    data               JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    version            BIGINT NOT NULL DEFAULT 1,
    sync_seq           BIGINT NOT NULL DEFAULT 0,
    client_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_device_id     TEXT,
    CONSTRAINT documents_collection_chk CHECK (collection ~ '^[a-zA-Z][a-zA-Z0-9]{0,39}$'),
    CONSTRAINT documents_data_object_chk CHECK (jsonb_typeof(data) = 'object'),
    -- Un capitolo con qualche foto ci sta largo; un archivio intero no.
    CONSTRAINT documents_data_size_chk CHECK (pg_column_size(data) <= 12 * 1024 * 1024),
    CONSTRAINT documents_version_chk CHECK (version > 0)
);

COMMENT ON TABLE documents IS
    'Quaderni, capitoli, appuntamenti, cartelle, tabelle… Contenuto privato: nessuna rotta /admin lo legge.';

CREATE TRIGGER trg_documents_sync BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION nina_touch_sync();

CREATE INDEX documents_user_seq_idx ON documents (user_id, sync_seq);
CREATE INDEX documents_user_collection_idx ON documents (user_id, collection) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Contenuto dei file
-- ---------------------------------------------------------------------------

CREATE TABLE file_blobs (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mime        TEXT NOT NULL DEFAULT 'application/octet-stream',
    size        INTEGER NOT NULL,
    content     BYTEA NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT file_blobs_size_chk CHECK (size >= 0 AND size = octet_length(content))
);

COMMENT ON TABLE file_blobs IS
    'Il contenuto dei documenti dell''archivio. I metadati (nome, cartella) sono un documento della collezione "files" con lo stesso id.';

CREATE INDEX file_blobs_user_idx ON file_blobs (user_id);

COMMIT;
