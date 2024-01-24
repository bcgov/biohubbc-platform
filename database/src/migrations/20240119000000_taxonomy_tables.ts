import { Knex } from 'knex';

/**
 * Add tables:
 * - taxon
 * - taxon_alias
 * - taxon_alias_origin
 * - language_lookup
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
      taxon_id                integer                   GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      itis_tsn                integer                   NOT NULL,
      bc_taxon_code           varchar(50),
      itis_scientific_name    varchar(300)              NOT NULL,
      common_name             varchar(50),
      itis_data               jsonb                     NOT NULL,
      itis_update_date        timestamptz(6)            NOT NULL,
      record_effective_date   date                      DEFAULT now() NOT NULL,
      record_end_date         date,
      create_date             timestamptz(6)            DEFAULT now() NOT NULL,
      create_user             integer                   NOT NULL,
      update_date             timestamptz(6),
      update_user             integer,
      revision_count          integer                   DEFAULT 0 NOT NULL,

      CONSTRAINT              taxon_pk                  PRIMARY KEY (taxon_id)
    );

    COMMENT ON COLUMN taxon.taxon_id                    IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN taxon.itis_tsn                    IS 'ITIS primary key identifier, populated from ITIS response. ITIS (Integrated Taxonomic Information System), TSN (Taxonomic Serial Number). https://itis.gov/pdf/faq_itis_tsn.pdf';
    COMMENT ON COLUMN taxon.bc_taxon_code               IS 'British Columbia standard taxon identifier.';
    COMMENT ON COLUMN taxon.itis_scientific_name        IS 'ITIS taxon scientific name, populated from ITIS response.';
    COMMENT ON COLUMN taxon.common_name                 IS 'Taxon common name, initially populated from ITIS response.';
    COMMENT ON COLUMN taxon.itis_data                   IS 'Raw ITIS payload, populated from ITIS response.';
    COMMENT ON COLUMN taxon.itis_update_date            IS 'The datetime the ITIS taxon was updated, populated from ITIS response.';
    COMMENT ON COLUMN taxon.record_effective_date       IS 'Record level effective date.';
    COMMENT ON COLUMN taxon.record_end_date             IS 'Record level end date.';
    COMMENT ON COLUMN taxon.create_date                 IS 'The datetime the record was created.';
    COMMENT ON COLUMN taxon.create_user                 IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN taxon.update_date                 IS 'The datetime the record was updated.';
    COMMENT ON COLUMN taxon.update_user                 IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN taxon.revision_count              IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  taxon                             IS 'Taxon cache table, extending ITIS webservice response.';

    CREATE TABLE taxon_alias (
      taxon_alias_id          integer                   GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      taxon_id                integer                   NOT NULL,
      language_id             integer                   NOT NULL,
      taxon_alias_origin_id   integer                   NOT NULL,
      alias                   varchar(300)              NOT NULL,
      record_effective_date   date                      DEFAULT now() NOT NULL,
      record_end_date         date,
      create_date             timestamptz(6)            DEFAULT now() NOT NULL,
      create_user             integer                   NOT NULL,
      update_date             timestamptz(6),
      update_user             integer,
      revision_count          integer                   DEFAULT 0 NOT NULL,

      CONSTRAINT              taxon_alias_pk            PRIMARY KEY (taxon_alias_id)
    );

    COMMENT ON COLUMN taxon_alias.taxon_alias_id        IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN taxon_alias.taxon_id              IS 'A foreign key that points to a taxon.';
    COMMENT ON COLUMN taxon_alias.language_id           IS 'A foreign key that points to a language.';
    COMMENT ON COLUMN taxon_alias.taxon_alias_origin_id IS 'A foreign key that points to a taxon alias origin.';
    COMMENT ON COLUMN taxon_alias.alias                 IS 'A taxon alias.';
    COMMENT ON COLUMN taxon_alias.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN taxon_alias.record_end_date       IS 'Record level end date.';
    COMMENT ON COLUMN taxon_alias.create_date           IS 'The datetime the record was created.';
    COMMENT ON COLUMN taxon_alias.create_user           IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN taxon_alias.update_date           IS 'The datetime the record was updated.';
    COMMENT ON COLUMN taxon_alias.update_user           IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN taxon_alias.revision_count        IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  taxon_alias                       IS 'Taxon alias table, for assigning additional alias names to taxons.';

    CREATE TABLE language_lookup (
      language_id             integer                   GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      language                varchar(100)              NOT NULL,
      create_date             timestamptz(6)            DEFAULT now() NOT NULL,
      create_user             integer                   NOT NULL,
      update_date             timestamptz(6),
      update_user             integer,
      revision_count          integer                   DEFAULT 0 NOT NULL,

      CONSTRAINT              language_lookup_pk        PRIMARY KEY (language_id)
    );

    COMMENT ON COLUMN language_lookup.language_id       IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN language_lookup.language          IS 'The name of the language.';
    COMMENT ON COLUMN language_lookup.create_date       IS 'The datetime the record was created.';
    COMMENT ON COLUMN language_lookup.create_user       IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN language_lookup.update_date       IS 'The datetime the record was updated.';
    COMMENT ON COLUMN language_lookup.update_user       IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN language_lookup.revision_count    IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  language_lookup                   IS 'Language lookup table.';

    CREATE TABLE taxon_alias_origin (
      taxon_alias_origin_id   integer                   GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      origin                  varchar(100)              NOT NULL,
      create_date             timestamptz(6)            DEFAULT now() NOT NULL,
      create_user             integer                   NOT NULL,
      update_date             timestamptz(6),
      update_user             integer,
      revision_count          integer                   DEFAULT 0 NOT NULL,

      CONSTRAINT              taxon_alias_origin_pk     PRIMARY KEY (taxon_alias_origin_id)
    );

    COMMENT ON COLUMN taxon_alias_origin.taxon_alias_origin_id  IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN taxon_alias_origin.origin                 IS 'The source origin of the taxon alias.';
    COMMENT ON COLUMN taxon_alias_origin.create_date            IS 'The datetime the record was created.';
    COMMENT ON COLUMN taxon_alias_origin.create_user            IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN taxon_alias_origin.update_date            IS 'The datetime the record was updated.';
    COMMENT ON COLUMN taxon_alias_origin.update_user            IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN taxon_alias_origin.revision_count         IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  taxon_alias_origin                        IS 'Taxon alias origin lookup table.';

    ----------------------------------------------------------------------------------------
    -- Create table indexes and constraints
    ----------------------------------------------------------------------------------------
    ALTER TABLE taxon_alias ADD CONSTRAINT taxon_alias_fk1 FOREIGN KEY (taxon_id) REFERENCES taxon(taxon_id);
    ALTER TABLE taxon_alias ADD CONSTRAINT taxon_alias_fk2 FOREIGN KEY (language_id) REFERENCES language_lookup(language_id);
    ALTER TABLE taxon_alias ADD CONSTRAINT taxon_alias_fk3 FOREIGN KEY (taxon_alias_origin_id) REFERENCES taxon_alias_origin(taxon_alias_origin_id);

    CREATE INDEX taxon_alias_fk1 ON taxon_alias(taxon_id);
    CREATE INDEX taxon_alias_fk2 ON taxon_alias(language_id);
    CREATE INDEX taxon_alias_fk3 ON taxon_alias(taxon_alias_origin_id);

    -- Add unique end-date key constraints (taxon)
    CREATE UNIQUE INDEX taxon_nuk1 ON taxon(itis_scientific_name, (record_end_date is NULL)) where record_end_date is null;
    CREATE UNIQUE INDEX taxon_nuk2 ON taxon(bc_taxon_code, (record_end_date is NULL)) where record_end_date is null;
    CREATE UNIQUE INDEX taxon_nuk3 ON taxon(itis_tsn, (record_end_date is NULL)) where record_end_date is null;

    -- Add unique end-date key constraints (taxon_alias)
    CREATE UNIQUE INDEX taxon_alias_nuk1 ON taxon_alias(taxon_id, alias, language_id, taxon_alias_origin_id, (record_end_date is NULL)) where record_end_date is null;

    ----------------------------------------------------------------------------------------
    -- Create table triggers
    ----------------------------------------------------------------------------------------
    create trigger audit_taxon before insert or update or delete on taxon for each row execute procedure tr_audit_trigger();
    create trigger journal_taxon after insert or update or delete on taxon for each row execute procedure tr_journal_trigger();

    create trigger audit_taxon_alias before insert or update or delete on taxon_alias for each row execute procedure tr_audit_trigger();
    create trigger journal_taxon_alias after insert or update or delete on taxon_alias for each row execute procedure tr_journal_trigger();

    create trigger audit_language_lookup before insert or update or delete on language_lookup for each row execute procedure tr_audit_trigger();
    create trigger journal_language_lookup after insert or update or delete on language_lookup for each row execute procedure tr_journal_trigger();

    create trigger audit_taxon_alias_origin before insert or update or delete on taxon_alias_origin for each row execute procedure tr_audit_trigger();
    create trigger journal_taxon_alias_origin after insert or update or delete on taxon_alias_origin for each row execute procedure tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
