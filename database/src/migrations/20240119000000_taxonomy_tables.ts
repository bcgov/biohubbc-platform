import { Knex } from 'knex';

/**
 * Add tables:
 * - taxon
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    ----------------------------------------------------------------------------------------
    -- Create table
    ----------------------------------------------------------------------------------------
    set search_path=biohub,public;

    CREATE TABLE taxon (
      taxon_id                integer             GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      bc_taxon_code           varchar(10),
      itis_tsn                integer             NOT NULL,
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
      CONSTRAINT taxon_pk PRIMARY KEY (taxon_id)
    );

    COMMENT ON COLUMN taxon.taxon_id              IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN taxon.bc_taxon_code         IS 'British Columbia standard Taxon identifier.';
    COMMENT ON COLUMN taxon.itis_tsn              IS 'ITIS primary key identifier, populated from ITIS response. ITIS (Integrated Taxonomic Information System), TSN (Taxonomic Serial Number). https://itis.gov/pdf/faq_itis_tsn.pdf';
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
    COMMENT ON TABLE taxon                        IS 'ITIS taxon cache table.';

    ----------------------------------------------------------------------------------------
    -- Create table triggers
    ----------------------------------------------------------------------------------------
    create trigger audit_region_lookup before insert or update or delete on taxon for each row execute procedure tr_audit_trigger();
    create trigger journal_region_lookup after insert or update or delete on taxon for each row execute procedure tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
