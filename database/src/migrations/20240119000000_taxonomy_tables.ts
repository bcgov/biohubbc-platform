import { Knex } from 'knex';

/**
 * Add tables:
 * - taxon
 * - taxon_alias
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    ----------------------------------------------------------------------------------------
    -- Create tables
    ----------------------------------------------------------------------------------------
    set search_path=biohub,public;

    CREATE TABLE taxon (
      taxon_id                integer             GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      itis_tsn                integer             NOT NULL,
      bc_taxon_code           varchar(10),
      scientific_name         varchar(50)         NOT NULL,
      common_name             varchar(50),
      itis_data               jsonb               NOT NULL,
      itis_update_date        timestamptz(6)      NOT NULL,
      record_effective_date   date                DEFAULT now() NOT NULL,
      record_end_date         date,
      create_date             timestamptz(6)      DEFAULT now() NOT NULL,
      create_user             integer             NOT NULL,
      update_date             timestamptz(6),
      update_user             integer,
      revision_count          integer             DEFAULT 0 NOT NULL,

      CONSTRAINT              taxon_pk            PRIMARY KEY (taxon_id)
    );

    COMMENT ON COLUMN taxon.taxon_id              IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN taxon.itis_tsn              IS 'ITIS primary key identifier, populated from ITIS response. ITIS (Integrated Taxonomic Information System), TSN (Taxonomic Serial Number). https://itis.gov/pdf/faq_itis_tsn.pdf';
    COMMENT ON COLUMN taxon.bc_taxon_code         IS 'British Columbia standard taxon identifier.';
    COMMENT ON COLUMN taxon.scientific_name       IS 'Taxon scientific name, initially populated from ITIS response.';
    COMMENT ON COLUMN taxon.common_name           IS 'Taxon common name, initially populated from ITIS response.';
    COMMENT ON COLUMN taxon.itis_data             IS 'Raw ITIS payload, populated from ITIS response.';
    COMMENT ON COLUMN taxon.itis_update_date      IS 'The datetime the ITIS taxon was updated, populated from ITIS response.';
    COMMENT ON COLUMN taxon.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN taxon.record_end_date       IS 'Record level end date.';
    COMMENT ON COLUMN taxon.create_date           IS 'The datetime the record was created.';
    COMMENT ON COLUMN taxon.create_user           IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN taxon.update_date           IS 'The datetime the record was updated.';
    COMMENT ON COLUMN taxon.update_user           IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN taxon.revision_count        IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  taxon                       IS 'Taxon cache table, extending ITIS webservice response.';

    CREATE TABLE taxon_alias (
      taxon_alias_id          integer             GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      taxon_id                integer             NOT NULL,
      alias                   varchar(50)         NOT NULL,
      create_date             timestamptz(6)      DEFAULT now() NOT NULL,
      create_user             integer             NOT NULL,
      update_date             timestamptz(6),
      update_user             integer,
      revision_count          integer             DEFAULT 0 NOT NULL,

      CONSTRAINT              taxon_alias_pk      PRIMARY KEY (taxon_alias_id)
    );

    COMMENT ON COLUMN taxon_alias.taxon_alias_id  IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN taxon_alias.taxon_id        IS 'A foreign key that points to a taxon.';
    COMMENT ON COLUMN taxon_alias.alias           IS 'A taxon alias.';
    COMMENT ON COLUMN taxon_alias.create_date     IS 'The datetime the record was created.';
    COMMENT ON COLUMN taxon_alias.create_user     IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN taxon_alias.update_date     IS 'The datetime the record was updated.';
    COMMENT ON COLUMN taxon_alias.update_user     IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN taxon_alias.revision_count  IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  taxon_alias                 IS 'Taxon alias table, for assigning additional alias names to taxons';

    ----------------------------------------------------------------------------------------
    -- Create table indexes and constraints
    ----------------------------------------------------------------------------------------
    ALTER TABLE taxon_alias ADD CONSTRAINT taxon_alias_fk1 FOREIGN KEY (taxon_id) REFERENCES taxon(taxon_id);

    CREATE INDEX taxon_alias_fk1 ON taxon_alias(taxon_id);

    -- Add unique end-date key constraints
    CREATE UNIQUE INDEX taxon_nuk1 ON taxon(scientific_name, (record_end_date is NULL)) where record_end_date is null;
    CREATE UNIQUE INDEX taxon_nuk2 ON taxon(bc_taxon_code, (record_end_date is NULL)) where record_end_date is null;
    CREATE UNIQUE INDEX taxon_nuk3 ON taxon(itis_tsn, (record_end_date is NULL)) where record_end_date is null;

    ----------------------------------------------------------------------------------------
    -- Create table triggers
    ----------------------------------------------------------------------------------------
    create trigger audit_taxon before insert or update or delete on taxon for each row execute procedure tr_audit_trigger();
    create trigger journal_taxon after insert or update or delete on taxon for each row execute procedure tr_journal_trigger();

    create trigger audit_taxon_alias before insert or update or delete on taxon_alias for each row execute procedure tr_audit_trigger();
    create trigger journal_taxon_alias after insert or update or delete on taxon_alias for each row execute procedure tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
