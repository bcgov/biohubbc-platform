import type { Knex } from 'knex';

/**
 * Make the Blueprint assignment the required provenance of every stored property value.
 *
 * `submission_feature_property_*.blueprint_feature_type_property_id` was added as optional provenance
 * (`20260625120000`) and backfilled only where the feature's Blueprint held an active assignment for the
 * value's global pairing, so rows written before Blueprints existed, rows whose pairing was re-created,
 * and rows written by seeds that never set it are still null. Once `feature_type_property` is removed
 * the assignment is the only thing that says which property a value belongs to, so it must be present
 * on every row.
 *
 * Every submission feature resolves to exactly one Blueprint (`submission_upload.blueprint_id` is NOT
 * NULL), so a null assignment can be derived: the assignment of the value's property, within the
 * feature's type, within the upload's Blueprint. No lifecycle filter is applied on the way: a value
 * written under an assignment that has since been retired keeps that assignment. The derivation is a
 * deterministic join over configuration tables in this database, which is why it runs here rather than
 * lazily (see `20260921120000`); it is preceded by a check that fails the migration, naming the rows, if
 * any row resolves to zero or to more than one assignment. Nothing is guessed and nothing is dropped.
 *
 * The composite foreign keys `(feature_type_property_id, blueprint_feature_type_property_id)` required the
 * stored assignment to carry the same pairing id as the row. A derived assignment may carry a different
 * pairing id for the same property (a pairing that was end-dated and re-created), and the pairing id is
 * about to be removed, so those keys are replaced by plain keys on the assignment id.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Pre-flight: every unresolved value must map to exactly one assignment, and every resolved
    --    value must already agree with its feature's type and its upload's Blueprint.
    ----------------------------------------------------------------------------------------
    DO $do$
    DECLARE
      tbl text;
      offending text;
      offending_total integer;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature'
      ]
      LOOP
        EXECUTE format($q$
          WITH candidates AS (
            SELECT p.%2$I AS row_id
            FROM %1$I p
            JOIN submission_feature sf ON sf.submission_feature_id = p.submission_feature_id
            JOIN submission_upload su ON su.submission_upload_id = sf.submission_upload_id
            JOIN feature_type_property ftp ON ftp.feature_type_property_id = p.feature_type_property_id
            LEFT JOIN blueprint_feature_type bft
              ON bft.blueprint_id = su.blueprint_id
             AND bft.feature_type_id = sf.feature_type_id
            LEFT JOIN blueprint_feature_type_property bftp
              ON bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
             AND bftp.feature_property_id = ftp.feature_property_id
            WHERE p.blueprint_feature_type_property_id IS NULL
            GROUP BY p.%2$I
            HAVING COUNT(bftp.blueprint_feature_type_property_id) <> 1
          ),
          numbered AS (
            SELECT row_id, row_number() OVER (ORDER BY row_id) AS rn FROM candidates
          )
          SELECT COUNT(*)::integer, string_agg(row_id::text, ', ' ORDER BY row_id) FILTER (WHERE rn <= 50)
          FROM numbered
        $q$, tbl, tbl || '_id')
        INTO offending_total, offending;

        IF offending_total > 0 THEN
          RAISE EXCEPTION
            '% rows in % cannot be mapped to exactly one blueprint assignment (orphan or ambiguous); first ids: %',
            offending_total, tbl, offending;
        END IF;
      END LOOP;

      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature',
        'submission_feature_property_artifact'
      ]
      LOOP
        EXECUTE format($q$
          SELECT COUNT(*)::integer, string_agg(p.%2$I::text, ', ') FILTER (WHERE p.%2$I IS NOT NULL)
          FROM (
            SELECT p.%2$I
            FROM %1$I p
            JOIN submission_feature sf ON sf.submission_feature_id = p.submission_feature_id
            JOIN submission_upload su ON su.submission_upload_id = sf.submission_upload_id
            JOIN blueprint_feature_type_property bftp
              ON bftp.blueprint_feature_type_property_id = p.blueprint_feature_type_property_id
            JOIN blueprint_feature_type bft
              ON bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
            WHERE bft.blueprint_id <> su.blueprint_id
               OR bft.feature_type_id <> sf.feature_type_id
            ORDER BY p.%2$I
            LIMIT 50
          ) p
        $q$, tbl, tbl || '_id')
        INTO offending_total, offending;

        IF offending_total > 0 THEN
          RAISE EXCEPTION
            'rows in % carry a blueprint assignment from another Blueprint or feature type; first ids: %',
            tbl, offending;
        END IF;
      END LOOP;
    END
    $do$;

    ----------------------------------------------------------------------------------------
    -- 2. Derive the assignment for unresolved values, require it, and key on it directly.
    ----------------------------------------------------------------------------------------
    DO $do$
    DECLARE
      tbl text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature'
      ]
      LOOP
        EXECUTE format($q$
          UPDATE %I p
          SET blueprint_feature_type_property_id = bftp.blueprint_feature_type_property_id
          FROM submission_feature sf,
               submission_upload su,
               feature_type_property ftp,
               blueprint_feature_type bft,
               blueprint_feature_type_property bftp
          WHERE p.blueprint_feature_type_property_id IS NULL
            AND sf.submission_feature_id = p.submission_feature_id
            AND su.submission_upload_id = sf.submission_upload_id
            AND ftp.feature_type_property_id = p.feature_type_property_id
            AND bft.blueprint_id = su.blueprint_id
            AND bft.feature_type_id = sf.feature_type_id
            AND bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
            AND bftp.feature_property_id = ftp.feature_property_id
        $q$, tbl);

        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_bftp_fk');
        EXECUTE format('ALTER TABLE %I ALTER COLUMN blueprint_feature_type_property_id SET NOT NULL', tbl);
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (blueprint_feature_type_property_id) REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id)',
          tbl, tbl || '_bftp_fk'
        );
        EXECUTE format(
          $c$COMMENT ON COLUMN %I.blueprint_feature_type_property_id IS 'Foreign key to blueprint_feature_type_property: the Blueprint assignment this value was stored under. Identifies the property, its feature type and its Blueprint; retained when the assignment is later retired.'$c$,
          tbl
        );
      END LOOP;
    END
    $do$;

    ALTER TABLE submission_feature_property_artifact
      DROP CONSTRAINT IF EXISTS submission_feature_property_artifact_fk3;
    ALTER TABLE submission_feature_property_artifact
      ADD CONSTRAINT submission_feature_property_artifact_bftp_fk
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);
  `);
}

/**
 * Reverses {@link up}: the assignment becomes optional again and the composite keys are restored.
 *
 * Derived assignments are left in place. Restoring a composite key fails if a derived assignment
 * carries a different pairing id than its row, which is the case the plain key was introduced for.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DO $do$
    DECLARE
      tbl text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature'
      ]
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_bftp_fk');
        EXECUTE format('ALTER TABLE %I ALTER COLUMN blueprint_feature_type_property_id DROP NOT NULL', tbl);
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (feature_type_property_id, blueprint_feature_type_property_id) REFERENCES blueprint_feature_type_property(feature_type_property_id, blueprint_feature_type_property_id)',
          tbl, tbl || '_bftp_fk'
        );
        EXECUTE format(
          $c$COMMENT ON COLUMN %I.blueprint_feature_type_property_id IS 'Foreign key to blueprint_feature_type_property: the Blueprint assignment used to validate/index this property. feature_type_property_id remains the primary property reference used by search and data access.'$c$,
          tbl
        );
      END LOOP;
    END
    $do$;

    ALTER TABLE submission_feature_property_artifact
      DROP CONSTRAINT IF EXISTS submission_feature_property_artifact_bftp_fk;
    ALTER TABLE submission_feature_property_artifact
      ADD CONSTRAINT submission_feature_property_artifact_fk3
      FOREIGN KEY (feature_type_property_id, blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(feature_type_property_id, blueprint_feature_type_property_id);
  `);
}
