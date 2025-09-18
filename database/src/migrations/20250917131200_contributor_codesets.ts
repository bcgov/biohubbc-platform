import { Knex } from 'knex';

/**
 * Creates the minimal `contributor`, `code_category`, `contributor_code_category`, and `contributor_code` tables.
 *
 * `contributor` = a system or organization contributing data.
 * `code_category` = categories/types of codes (e.g., "sign", "status", "habitat").
 * `contributor_code_category` = contributor-specific descriptions/names for code categories.
 * `contributor_code` = a code mapping where code_category is the key (e.g., "sign")
 *                      and value is the value (e.g., "1" or "direct_observation").
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub;

    ---------------------------------------------------
    -- Contributor table
    ---------------------------------------------------

    CREATE TABLE contributor (
      contributor_id          integer                   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name                    varchar(100)              NOT NULL UNIQUE,
      description             varchar(1000),
      record_end_date         timestamptz(6),
      create_date             timestamptz(6)            DEFAULT now() NOT NULL,
      create_user             integer                   NOT NULL,
      update_date             timestamptz(6),
      update_user             integer,
      revision_count          integer                   DEFAULT 0 NOT NULL
    );

    COMMENT ON TABLE contributor IS 'A system, organization, or source that contributes data to this system.';
    COMMENT ON COLUMN contributor.contributor_id IS 'System-generated primary key.';
    COMMENT ON COLUMN contributor.name IS 'The name of the contributing system or organization.';
    COMMENT ON COLUMN contributor.description IS 'Optional description of the contributor.';
    COMMENT ON COLUMN contributor.record_end_date IS 'The date the record was soft-deleted or expired.';
    COMMENT ON COLUMN contributor.create_date IS 'Timestamp when the record was created.';
    COMMENT ON COLUMN contributor.create_user IS 'ID of the user who created the record.';
    COMMENT ON COLUMN contributor.update_date IS 'Timestamp when the record was last updated.';
    COMMENT ON COLUMN contributor.update_user IS 'ID of the user who last updated the record.';
    COMMENT ON COLUMN contributor.revision_count IS 'Concurrency control field.';

    ---------------------------------------------------
    -- Code Category table
    ---------------------------------------------------

    CREATE TABLE code_category (
      code_category_id        integer                   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name                    varchar(100)              NOT NULL UNIQUE,
      description             varchar(1000),
      record_end_date         timestamptz(6),
      create_date             timestamptz(6)            DEFAULT now() NOT NULL,
      create_user             integer                   NOT NULL,
      update_date             timestamptz(6),
      update_user             integer,
      revision_count          integer                   DEFAULT 0 NOT NULL
    );

    COMMENT ON TABLE code_category IS 'Categories/types of codes (e.g., sign, status, habitat).';
    COMMENT ON COLUMN code_category.code_category_id IS 'System-generated primary key.';
    COMMENT ON COLUMN code_category.name IS 'The name of the code category (e.g., "sign", "status", "habitat").';
    COMMENT ON COLUMN code_category.description IS 'Optional description of the code category.';
    COMMENT ON COLUMN code_category.record_end_date IS 'The date the record was soft-deleted or expired.';
    COMMENT ON COLUMN code_category.create_date IS 'Timestamp when the record was created.';
    COMMENT ON COLUMN code_category.create_user IS 'ID of the user who created the record.';
    COMMENT ON COLUMN code_category.update_date IS 'Timestamp when the record was last updated.';
    COMMENT ON COLUMN code_category.update_user IS 'ID of the user who last updated the record.';
    COMMENT ON COLUMN code_category.revision_count IS 'Concurrency control field.';

    ---------------------------------------------------
    -- Contributor Code Category table
    ---------------------------------------------------

    CREATE TABLE contributor_code_category (
      contributor_code_category_id  integer              GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      contributor_id               integer               NOT NULL,
      code_category_id            integer                NOT NULL,
      contributor_name            varchar(100),
      contributor_description     varchar(1000)          NOT NULL,
      record_end_date             timestamptz(6),
      create_date                 timestamptz(6)         DEFAULT now() NOT NULL,
      create_user                 integer                NOT NULL,
      update_date                 timestamptz(6),
      update_user                 integer,
      revision_count              integer                DEFAULT 0 NOT NULL,

      CONSTRAINT contributor_code_category_contributor_fk FOREIGN KEY (contributor_id) REFERENCES contributor(contributor_id),
      CONSTRAINT contributor_code_category_code_category_fk FOREIGN KEY (code_category_id) REFERENCES code_category(code_category_id)
    );

    CREATE INDEX contributor_code_category_contributor_idx ON contributor_code_category (contributor_id);
    CREATE INDEX contributor_code_category_code_category_idx ON contributor_code_category (code_category_id);

    -- Unique constraint: one contributor cannot have duplicate code categories (for active records)
    CREATE UNIQUE INDEX contributor_code_category_nuk1 ON contributor_code_category(
      contributor_id, 
      code_category_id, 
      (record_end_date IS NULL)
    ) WHERE record_end_date IS NULL;

    COMMENT ON TABLE contributor_code_category IS 'Contributor-specific descriptions and names for code categories.';
    COMMENT ON COLUMN contributor_code_category.contributor_code_category_id IS 'System-generated primary key.';
    COMMENT ON COLUMN contributor_code_category.contributor_id IS 'Foreign key to the contributor.';
    COMMENT ON COLUMN contributor_code_category.code_category_id IS 'Foreign key to the global code category.';
    COMMENT ON COLUMN contributor_code_category.contributor_name IS 'The contributor-specific name for this code category.';
    COMMENT ON COLUMN contributor_code_category.contributor_description IS 'The contributor-specific description of this code category.';
    COMMENT ON COLUMN contributor_code_category.record_end_date IS 'The date the record was soft-deleted or expired.';
    COMMENT ON COLUMN contributor_code_category.create_date IS 'Timestamp when the record was created.';
    COMMENT ON COLUMN contributor_code_category.create_user IS 'ID of the user who created the record.';
    COMMENT ON COLUMN contributor_code_category.update_date IS 'Timestamp when the record was last updated.';
    COMMENT ON COLUMN contributor_code_category.update_user IS 'ID of the user who last updated the record.';
    COMMENT ON COLUMN contributor_code_category.revision_count IS 'Concurrency control field.';

    ---------------------------------------------------
    -- Contributor Code table
    ---------------------------------------------------

    CREATE TABLE contributor_code (
      contributor_code_id     integer                   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code_category_id        integer                   NOT NULL,
      value                   varchar(100)              NOT NULL,
      name                    varchar(100)              NOT NULL,
      description             varchar(1000),
      record_end_date         timestamptz(6),
      create_date             timestamptz(6)            DEFAULT now() NOT NULL,
      create_user             integer                   NOT NULL,
      update_date             timestamptz(6),
      update_user             integer,
      revision_count          integer                   DEFAULT 0 NOT NULL,

      CONSTRAINT contributor_code_contributor_fk FOREIGN KEY (contributor_id) REFERENCES contributor(contributor_id),
      CONSTRAINT contributor_code_category_fk FOREIGN KEY (code_category_id) REFERENCES code_category(code_category_id)
    );

    CREATE INDEX contributor_code_contributor_idx ON contributor_code (contributor_id);
    CREATE INDEX contributor_code_category_idx ON contributor_code (code_category_id);
    CREATE INDEX contributor_code_biohub_name_idx ON contributor_code (name     );
    
    -- Unique constraint: one contributor cannot have duplicate category/name combinations (for active records)
    CREATE UNIQUE INDEX contributor_code_nuk1 ON contributor_code(
      contributor_id, 
      code_category_id, 
      value, 
      (record_end_date IS NULL)
    ) WHERE record_end_date IS NULL;

    COMMENT ON TABLE contributor_code IS 'Code mappings from contributor systems to standardized BiodiversityHub codes.';
    COMMENT ON COLUMN contributor_code.contributor_code_id IS 'System-generated primary key.';
    COMMENT ON COLUMN contributor_code.contributor_id IS 'Foreign key to the contributor that owns this code.';
    COMMENT ON COLUMN contributor_code.code_category_id IS 'Foreign key to the code category this code belongs to.';
    COMMENT ON COLUMN contributor_code.value IS 'The actual code value from the contributor system (e.g., "1", "direct_observation").';
    COMMENT ON COLUMN contributor_code.name      IS 'Standardized code name to display';
    COMMENT ON COLUMN contributor_code.description IS 'Human-readable description of what this code means.';
    COMMENT ON COLUMN contributor_code.record_end_date IS 'The date the record was soft-deleted or expired.';
    COMMENT ON COLUMN contributor_code.create_date IS 'Timestamp when the record was created.';
    COMMENT ON COLUMN contributor_code.create_user IS 'ID of the user who created the record.';
    COMMENT ON COLUMN contributor_code.update_date IS 'Timestamp when the record was last updated.';
    COMMENT ON COLUMN contributor_code.update_user IS 'ID of the user who last updated the record.';
    COMMENT ON COLUMN contributor_code.revision_count IS 'Concurrency control field.';

    ----------------------------------------------------------------------------------------
    -- Create audit and journal triggers
    ----------------------------------------------------------------------------------------

    create trigger audit_contributor before insert or update or delete on contributor for each row execute procedure tr_audit_trigger();
    create trigger journal_contributor after insert or update or delete on contributor for each row execute procedure tr_journal_trigger();

    create trigger audit_contributor_code before insert or update or delete on contributor_code for each row execute procedure tr_audit_trigger();
    create trigger journal_contributor_code after insert or update or delete on contributor_code for each row execute procedure tr_journal_trigger();

    create trigger audit_code_category before insert or update or delete on code_category for each row execute procedure tr_audit_trigger();
    create trigger journal_code_category after insert or update or delete on code_category for each row execute procedure tr_journal_trigger();

    create trigger audit_contributor_code_category before insert or update or delete on contributor_code_category for each row execute procedure tr_audit_trigger();
    create trigger journal_contributor_code_category after insert or update or delete on contributor_code_category for each row execute procedure tr_journal_trigger();
  `);
}

/**
 * Drops the contributor and contributor_code tables and related objects.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub;

    DROP TABLE IF EXISTS contributor_code;
    DROP TABLE IF EXISTS contributor_code_category;
    DROP TABLE IF EXISTS code_category;
    DROP TABLE IF EXISTS contributor;
  `);
}
