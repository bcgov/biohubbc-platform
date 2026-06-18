import { Knex } from 'knex';

/**
 * Adds the versioned Blueprint tables.
 *
 * A Blueprint is a versioned, named schema configuration that captures which feature types are
 * included, which properties are assigned to each feature type, and (per assignment) whether the
 * property is required and whether it allows multiple values. This assignment information
 * previously lived on `feature_type_property` (`required_value`, `allow_multiple`); moving it into
 * Blueprints lets feature property indexing target a specific, immutable schema configuration.
 *
 * Tables added:
 * - `blueprint` — the versioned schema configuration itself.
 * - `blueprint_feature_type` — which feature types a Blueprint includes.
 * - `blueprint_feature_type_property` — which properties are assigned to each feature type, with
 *   `required_value` and `allow_multiple` per assignment.
 *
 * Availability semantics (governed by date columns, no DDL of their own):
 * - A Blueprint with `record_effective_date` set and `record_end_date` null is available for indexing.
 * - A Blueprint with no `record_effective_date` is a draft and is not available for indexing.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Create the blueprint table.
    ----------------------------------------------------------------------------------------
    CREATE TABLE blueprint (
      blueprint_id          integer        GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      version_number        integer        NOT NULL,
      name                  text           NOT NULL,
      description           text,
      is_default            boolean        DEFAULT false NOT NULL,
      parent_blueprint_id   integer,
      record_effective_date date,
      record_end_date       date,
      create_date           timestamptz(6) DEFAULT now() NOT NULL,
      create_user           integer        NOT NULL,
      update_date           timestamptz(6),
      update_user           integer,
      revision_count        integer        DEFAULT 0 NOT NULL,
      CONSTRAINT blueprint_pk PRIMARY KEY (blueprint_id),
      CONSTRAINT blueprint_parent_blueprint_fk FOREIGN KEY (parent_blueprint_id) REFERENCES blueprint(blueprint_id),
      -- A draft Blueprint (no record_effective_date) may not be marked as the default.
      CONSTRAINT blueprint_default_requires_effective_date CHECK (record_effective_date IS NOT NULL OR is_default = false)
    );

    CREATE INDEX blueprint_parent_blueprint_id_idx ON blueprint(parent_blueprint_id);

    -- Only one active row per version_number.
    CREATE UNIQUE INDEX blueprint_nuk1 ON blueprint(version_number) WHERE record_end_date is null;

    -- At most one active default Blueprint.
    CREATE UNIQUE INDEX blueprint_nuk2 ON blueprint(is_default) WHERE is_default = true AND record_end_date is null;

    COMMENT ON TABLE blueprint IS 'A versioned, named schema configuration describing which feature types are included and how their properties are assigned. Available for indexing when record_effective_date is set and record_end_date is null; a draft otherwise.';
    COMMENT ON COLUMN blueprint.blueprint_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN blueprint.version_number IS 'The version number of this Blueprint. Unique among active (non-ended) Blueprints.';
    COMMENT ON COLUMN blueprint.name IS 'Human-readable name of the Blueprint.';
    COMMENT ON COLUMN blueprint.description IS 'Human-readable description of the Blueprint.';
    COMMENT ON COLUMN blueprint.is_default IS 'Indicates the default Blueprint. At most one active Blueprint may be the default.';
    COMMENT ON COLUMN blueprint.parent_blueprint_id IS 'Foreign key to the blueprint this version was derived from; null for a root Blueprint.';
    COMMENT ON COLUMN blueprint.record_effective_date IS 'The date the Blueprint became available for indexing. Null indicates a draft Blueprint that is not yet available.';
    COMMENT ON COLUMN blueprint.record_end_date IS 'The date the Blueprint was retired (soft delete); null when the record is active.';
    COMMENT ON COLUMN blueprint.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN blueprint.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN blueprint.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN blueprint.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN blueprint.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_blueprint
      BEFORE INSERT OR UPDATE OR DELETE ON blueprint
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_blueprint
      AFTER INSERT OR UPDATE OR DELETE ON blueprint
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- 2. Create the blueprint_feature_type table.
    ----------------------------------------------------------------------------------------
    CREATE TABLE blueprint_feature_type (
      blueprint_feature_type_id integer        GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      blueprint_id              integer        NOT NULL,
      feature_type_id           integer        NOT NULL,
      sort                      integer,
      record_end_date           date,
      create_date               timestamptz(6) DEFAULT now() NOT NULL,
      create_user               integer        NOT NULL,
      update_date               timestamptz(6),
      update_user               integer,
      revision_count            integer        DEFAULT 0 NOT NULL,
      CONSTRAINT blueprint_feature_type_pk PRIMARY KEY (blueprint_feature_type_id),
      CONSTRAINT blueprint_feature_type_blueprint_fk FOREIGN KEY (blueprint_id) REFERENCES blueprint(blueprint_id),
      CONSTRAINT blueprint_feature_type_feature_type_fk FOREIGN KEY (feature_type_id) REFERENCES feature_type(feature_type_id)
    );

    CREATE INDEX blueprint_feature_type_blueprint_id_idx ON blueprint_feature_type(blueprint_id);
    CREATE INDEX blueprint_feature_type_feature_type_id_idx ON blueprint_feature_type(feature_type_id);

    -- Each feature type may be included at most once per active Blueprint row.
    CREATE UNIQUE INDEX blueprint_feature_type_nuk1 ON blueprint_feature_type(blueprint_id, feature_type_id) WHERE record_end_date is null;

    COMMENT ON TABLE blueprint_feature_type IS 'The feature types included in a Blueprint.';
    COMMENT ON COLUMN blueprint_feature_type.blueprint_feature_type_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN blueprint_feature_type.blueprint_id IS 'Foreign key to the blueprint table.';
    COMMENT ON COLUMN blueprint_feature_type.feature_type_id IS 'Foreign key to the feature_type table.';
    COMMENT ON COLUMN blueprint_feature_type.sort IS 'Optional ordering of feature types within the Blueprint.';
    COMMENT ON COLUMN blueprint_feature_type.record_end_date IS 'The date the assignment was retired (soft delete); null when the record is active.';
    COMMENT ON COLUMN blueprint_feature_type.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN blueprint_feature_type.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN blueprint_feature_type.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN blueprint_feature_type.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN blueprint_feature_type.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_blueprint_feature_type
      BEFORE INSERT OR UPDATE OR DELETE ON blueprint_feature_type
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_blueprint_feature_type
      AFTER INSERT OR UPDATE OR DELETE ON blueprint_feature_type
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- 3. Create the blueprint_feature_type_property table.
    ----------------------------------------------------------------------------------------
    CREATE TABLE blueprint_feature_type_property (
      blueprint_feature_type_property_id integer        GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      blueprint_feature_type_id          integer        NOT NULL,
      feature_type_property_id           integer        NOT NULL,
      required_value                     boolean        DEFAULT false NOT NULL,
      allow_multiple                     boolean        DEFAULT false NOT NULL,
      sort                               integer,
      record_end_date                    date,
      create_date                        timestamptz(6) DEFAULT now() NOT NULL,
      create_user                        integer        NOT NULL,
      update_date                        timestamptz(6),
      update_user                        integer,
      revision_count                     integer        DEFAULT 0 NOT NULL,
      CONSTRAINT blueprint_feature_type_property_pk PRIMARY KEY (blueprint_feature_type_property_id),
      CONSTRAINT blueprint_feature_type_property_blueprint_feature_type_fk FOREIGN KEY (blueprint_feature_type_id) REFERENCES blueprint_feature_type(blueprint_feature_type_id),
      CONSTRAINT blueprint_feature_type_property_feature_type_property_fk FOREIGN KEY (feature_type_property_id) REFERENCES feature_type_property(feature_type_property_id)
    );

    CREATE INDEX blueprint_feature_type_property_blueprint_feature_type_id_idx ON blueprint_feature_type_property(blueprint_feature_type_id);
    CREATE INDEX blueprint_feature_type_property_feature_type_property_id_idx ON blueprint_feature_type_property(feature_type_property_id);

    -- Each feature_type_property may be assigned at most once per Blueprint feature type among active rows.
    CREATE UNIQUE INDEX blueprint_feature_type_property_nuk1 ON blueprint_feature_type_property(blueprint_feature_type_id, feature_type_property_id) WHERE record_end_date is null;

    COMMENT ON TABLE blueprint_feature_type_property IS 'The properties assigned to each feature type within a Blueprint, including whether each is required and whether it allows multiple values.';
    COMMENT ON COLUMN blueprint_feature_type_property.blueprint_feature_type_property_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN blueprint_feature_type_property.blueprint_feature_type_id IS 'Foreign key to the blueprint_feature_type table; identifies the feature type included in the Blueprint that this property is assigned to.';
    COMMENT ON COLUMN blueprint_feature_type_property.feature_type_property_id IS 'Foreign key to the feature_type_property table; the global feature-type/property pool entry being assigned within this Blueprint.';
    COMMENT ON COLUMN blueprint_feature_type_property.required_value IS 'Per-Blueprint override indicating the property is required for the feature type within this Blueprint and can be assumed non-null.';
    COMMENT ON COLUMN blueprint_feature_type_property.allow_multiple IS 'Per-Blueprint override indicating the property may carry multiple values (a JSON array) for the feature type within this Blueprint.';
    COMMENT ON COLUMN blueprint_feature_type_property.sort IS 'Optional ordering of properties within the feature type.';
    COMMENT ON COLUMN blueprint_feature_type_property.record_end_date IS 'The date the assignment was retired (soft delete); null when the record is active.';
    COMMENT ON COLUMN blueprint_feature_type_property.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN blueprint_feature_type_property.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN blueprint_feature_type_property.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN blueprint_feature_type_property.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN blueprint_feature_type_property.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_blueprint_feature_type_property
      BEFORE INSERT OR UPDATE OR DELETE ON blueprint_feature_type_property
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_blueprint_feature_type_property
      AFTER INSERT OR UPDATE OR DELETE ON blueprint_feature_type_property
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

/**
 * Roll back the Blueprint tables and all associated objects.
 *
 * Drop order: child tables first (FKs reference `blueprint`), then `blueprint`.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_blueprint_feature_type_property ON blueprint_feature_type_property;
    DROP TRIGGER IF EXISTS audit_blueprint_feature_type_property ON blueprint_feature_type_property;
    DROP TRIGGER IF EXISTS journal_blueprint_feature_type ON blueprint_feature_type;
    DROP TRIGGER IF EXISTS audit_blueprint_feature_type ON blueprint_feature_type;
    DROP TRIGGER IF EXISTS journal_blueprint ON blueprint;
    DROP TRIGGER IF EXISTS audit_blueprint ON blueprint;

    DROP TABLE IF EXISTS blueprint_feature_type_property;
    DROP TABLE IF EXISTS blueprint_feature_type;
    DROP TABLE IF EXISTS blueprint;
  `);
}
