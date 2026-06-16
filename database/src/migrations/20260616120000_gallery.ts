import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- GALLERY
    --------------------------------------------------------------------------------

    CREATE TABLE gallery (
      gallery_id      INTEGER        GENERATED ALWAYS AS IDENTITY NOT NULL,
      name            TEXT           NOT NULL,
      description     TEXT,
      record_end_date TIMESTAMPTZ(6),
      create_date     TIMESTAMPTZ(6) DEFAULT now() NOT NULL,
      create_user     INTEGER        NOT NULL,
      update_date     TIMESTAMPTZ(6),
      update_user     INTEGER,
      revision_count  INTEGER        DEFAULT 0 NOT NULL,
      CONSTRAINT gallery_pk PRIMARY KEY (gallery_id)
    );

    CREATE UNIQUE INDEX gallery_nuk1
      ON gallery(name)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE gallery IS 'A curated, reusable collection of downloads for display in curated areas of the application.';
    COMMENT ON COLUMN gallery.gallery_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN gallery.name IS 'The display name of the gallery; unique among active galleries.';
    COMMENT ON COLUMN gallery.description IS 'An optional description of the gallery.';
    COMMENT ON COLUMN gallery.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN gallery.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN gallery.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN gallery.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN gallery.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN gallery.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- GALLERY_DOWNLOAD
    --------------------------------------------------------------------------------

    CREATE TABLE gallery_download (
      gallery_download_id INTEGER        GENERATED ALWAYS AS IDENTITY NOT NULL,
      gallery_id          INTEGER        NOT NULL,
      download_id         UUID           NOT NULL,
      sort                INTEGER,
      record_end_date     TIMESTAMPTZ(6),
      create_date         TIMESTAMPTZ(6) DEFAULT now() NOT NULL,
      create_user         INTEGER        NOT NULL,
      update_date         TIMESTAMPTZ(6),
      update_user         INTEGER,
      revision_count      INTEGER        DEFAULT 0 NOT NULL,
      CONSTRAINT gallery_download_pk  PRIMARY KEY (gallery_download_id),
      CONSTRAINT gallery_download_fk1 FOREIGN KEY (gallery_id)  REFERENCES gallery(gallery_id),
      CONSTRAINT gallery_download_fk2 FOREIGN KEY (download_id) REFERENCES download(download_id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX gallery_download_nuk1
      ON gallery_download(gallery_id, download_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX gallery_download_idx1 ON gallery_download(gallery_id);
    CREATE INDEX gallery_download_idx2 ON gallery_download(download_id);

    COMMENT ON TABLE gallery_download IS 'Join table linking downloads to a gallery, with display ordering.';
    COMMENT ON COLUMN gallery_download.gallery_download_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN gallery_download.gallery_id IS 'Foreign key to the gallery table.';
    COMMENT ON COLUMN gallery_download.download_id IS 'Foreign key to the download table.';
    COMMENT ON COLUMN gallery_download.sort IS 'Manual display order within the gallery; null sorts last.';
    COMMENT ON COLUMN gallery_download.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN gallery_download.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN gallery_download.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN gallery_download.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN gallery_download.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN gallery_download.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_gallery
      BEFORE INSERT OR UPDATE OR DELETE ON gallery
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_gallery
      AFTER INSERT OR UPDATE OR DELETE ON gallery
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_gallery_download
      BEFORE INSERT OR UPDATE OR DELETE ON gallery_download
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_gallery_download
      AFTER INSERT OR UPDATE OR DELETE ON gallery_download
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Dropping the tables also drops their indexes and triggers. Order is load-bearing:
  // gallery_download FKs to gallery, so it must be dropped first.
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TABLE IF EXISTS gallery_download;
    DROP TABLE IF EXISTS gallery;
  `);
}
