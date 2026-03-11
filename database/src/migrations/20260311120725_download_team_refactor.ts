import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- DOWNLOAD_TEAM (SIMSBIOHUB-898: replaces download_share + download.system_user_id + download.team_id)
    --------------------------------------------------------------------------------

    CREATE TABLE download_team (
      download_team_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
      download_id uuid NOT NULL,
      team_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT download_team_pk PRIMARY KEY (download_team_id),
      CONSTRAINT download_team_fk1 FOREIGN KEY (download_id) REFERENCES download(download_id) ON DELETE CASCADE,
      CONSTRAINT download_team_fk2 FOREIGN KEY (team_id) REFERENCES team(team_id)
    );

    CREATE UNIQUE INDEX download_team_nuk1
      ON download_team (download_id, team_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX download_team_idx1 ON download_team(download_id);
    CREATE INDEX download_team_idx2 ON download_team(team_id);

    COMMENT ON TABLE download_team IS 'Join table linking downloads to teams for team-based access control. Populated at download creation for authenticated users. Anonymous downloads have no rows.';
    COMMENT ON COLUMN download_team.download_team_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN download_team.download_id IS 'Foreign key to the download table.';
    COMMENT ON COLUMN download_team.team_id IS 'Foreign key to the team table.';
    COMMENT ON COLUMN download_team.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN download_team.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_team.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_team.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_team.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_team.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_download_team
      BEFORE INSERT OR UPDATE OR DELETE ON download_team
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_download_team
      AFTER INSERT OR UPDATE OR DELETE ON download_team
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- DROP LEGACY SHARING (download_share, download.system_user_id, download.team_id)
    --------------------------------------------------------------------------------

    DROP TABLE IF EXISTS download_share CASCADE;

    ALTER TABLE download DROP CONSTRAINT IF EXISTS download_system_user_fk;
    DROP INDEX IF EXISTS download_system_user_idx;
    ALTER TABLE download DROP COLUMN IF EXISTS system_user_id;

    ALTER TABLE download DROP CONSTRAINT IF EXISTS download_team_fk;
    DROP INDEX IF EXISTS download_idx1;
    ALTER TABLE download DROP COLUMN IF EXISTS team_id;

    ALTER TABLE download DROP CONSTRAINT IF EXISTS download_data_request_fk;
    ALTER TABLE download DROP COLUMN IF EXISTS data_request_id;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- Drop download_team triggers
    DROP TRIGGER IF EXISTS journal_download_team ON download_team;
    DROP TRIGGER IF EXISTS audit_download_team ON download_team;

    -- Drop download_team indexes
    DROP INDEX IF EXISTS download_team_nuk1;
    DROP INDEX IF EXISTS download_team_idx2;
    DROP INDEX IF EXISTS download_team_idx1;

    -- Drop download_team table
    DROP TABLE IF EXISTS download_team;

    -- Re-add data_request_id to download
    ALTER TABLE download ADD COLUMN data_request_id uuid;
    ALTER TABLE download ADD CONSTRAINT download_data_request_fk
      FOREIGN KEY (data_request_id) REFERENCES data_request(data_request_id);

    -- Re-add team_id to download
    ALTER TABLE download ADD COLUMN team_id uuid;
    ALTER TABLE download ADD CONSTRAINT download_team_fk
      FOREIGN KEY (team_id) REFERENCES team(team_id);
    CREATE INDEX download_idx1 ON download(team_id);

    -- Re-add system_user_id to download
    ALTER TABLE download ADD COLUMN system_user_id integer;
    ALTER TABLE download ADD CONSTRAINT download_system_user_fk
      FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id);
    CREATE INDEX download_system_user_idx ON download(system_user_id);

    -- Recreate download_share
    CREATE TABLE download_share (
      download_share_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
      download_id uuid NOT NULL,
      system_user_id integer NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT download_share_pk PRIMARY KEY (download_share_id),
      CONSTRAINT download_share_fk1 FOREIGN KEY (download_id) REFERENCES download(download_id) ON DELETE CASCADE,
      CONSTRAINT download_share_fk2 FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id),
      CONSTRAINT download_share_uk1 UNIQUE (download_id, system_user_id)
    );

    CREATE TRIGGER audit_download_share
      BEFORE INSERT OR UPDATE OR DELETE ON download_share
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_download_share
      AFTER INSERT OR UPDATE OR DELETE ON download_share
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}
