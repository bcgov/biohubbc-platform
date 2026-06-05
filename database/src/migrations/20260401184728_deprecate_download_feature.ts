import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- SIMSBIOHUB-950: Add cart_id FK to download, drop download_feature
    --------------------------------------------------------------------------------

    -- Add cart_id FK to download (nullable — filter-based downloads have no cart)
    ALTER TABLE download ADD COLUMN cart_id UUID;
    ALTER TABLE download ADD CONSTRAINT download_cart_fk
      FOREIGN KEY (cart_id) REFERENCES cart(cart_id);
    CREATE INDEX download_cart_idx ON download(cart_id);

    COMMENT ON COLUMN download.cart_id IS 'FK to cart table. Set for cart-based downloads, NULL for filter-based. Used to resolve features at pipeline time via cart_submission_feature.';

    -- Every download must have a feature source: either cart_id or filters
    ALTER TABLE download ADD CONSTRAINT download_feature_source_check
      CHECK (cart_id IS NOT NULL OR filters IS NOT NULL);

    --------------------------------------------------------------------------------
    -- DROP download_feature (0 rows — clean drop, no data migration needed)
    --------------------------------------------------------------------------------

    DROP TRIGGER IF EXISTS journal_download_feature ON download_feature;
    DROP TRIGGER IF EXISTS audit_download_feature ON download_feature;
    DROP INDEX IF EXISTS download_feature_idx2;
    DROP INDEX IF EXISTS download_feature_idx1;
    DROP TABLE IF EXISTS download_feature;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Recreate download_feature
    --------------------------------------------------------------------------------

    CREATE TABLE download_feature (
      download_feature_id       INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
      download_id               UUID NOT NULL,
      submission_feature_id     INTEGER NOT NULL,
      create_date               TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      create_user               INTEGER NOT NULL,
      update_date               TIMESTAMPTZ(6),
      update_user               INTEGER,
      revision_count            INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT download_feature_pk PRIMARY KEY (download_feature_id),
      CONSTRAINT download_feature_fk1 FOREIGN KEY (download_id) REFERENCES download(download_id) ON DELETE CASCADE,
      CONSTRAINT download_feature_fk2 FOREIGN KEY (submission_feature_id) REFERENCES submission_feature(submission_feature_id)
    );

    CREATE INDEX download_feature_idx1 ON download_feature(download_id);
    CREATE INDEX download_feature_idx2 ON download_feature(submission_feature_id);

    COMMENT ON TABLE download_feature IS 'Join table linking download requests to selected submission features.';
    COMMENT ON COLUMN download_feature.download_feature_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN download_feature.download_id IS 'Foreign key to the download table.';
    COMMENT ON COLUMN download_feature.submission_feature_id IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN download_feature.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_feature.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_feature.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_feature.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_feature.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_download_feature
      BEFORE INSERT OR UPDATE OR DELETE ON download_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_download_feature
      AFTER INSERT OR UPDATE OR DELETE ON download_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- Remove cart_id and CHECK constraint from download
    --------------------------------------------------------------------------------

    ALTER TABLE download DROP CONSTRAINT IF EXISTS download_feature_source_check;
    DROP INDEX IF EXISTS download_cart_idx;
    ALTER TABLE download DROP CONSTRAINT IF EXISTS download_cart_fk;
    ALTER TABLE download DROP COLUMN IF EXISTS cart_id;
  `);
}
