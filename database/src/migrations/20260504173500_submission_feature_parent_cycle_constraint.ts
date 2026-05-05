import type { Knex } from 'knex';

/**
 * Prevents active submission_feature parent links from forming cycles.
 *
 * The parent column already has a foreign key, but that only confirms the parent
 * row exists. It does not catch chains like A -> B -> C -> A, so this migration
 * adds a deferred trigger for that part.
 *
 * @param {Knex} knex - Migration knex connection.
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Self-parenting is the one cycle we can reject with a plain CHECK. Longer
    -- loops are handled by the trigger below.
    --
    --------------------------------------------------------------------------------

    ALTER TABLE submission_feature
      ADD CONSTRAINT submission_feature_parent_no_self_loop
      CHECK (
        parent_submission_feature_id IS NULL
        OR parent_submission_feature_id <> submission_feature_id
      );

    --------------------------------------------------------------------------------
    -- Check the data that is already in the table before adding the trigger. If
    -- there is an active cycle now, fail the migration and make someone fix the
    -- data instead of quietly installing a rule the table already violates.
    --
    -- This only looks at active rows. Old inactive rows can keep their historical
    -- parent values because they are not part of the current hierarchy.
    --------------------------------------------------------------------------------

    DO $$
    DECLARE
      _has_cycle boolean;
    BEGIN
      WITH RECURSIVE ancestors(start_id, ancestor_id, path, cycle) AS (
        SELECT
          sf.submission_feature_id,
          sf.parent_submission_feature_id,
          ARRAY[sf.submission_feature_id, sf.parent_submission_feature_id],
          sf.parent_submission_feature_id = sf.submission_feature_id
        FROM submission_feature sf
        WHERE sf.parent_submission_feature_id IS NOT NULL
          AND sf.record_end_date IS NULL
        UNION ALL
        SELECT
          ancestors.start_id,
          parent.parent_submission_feature_id,
          ancestors.path || parent.parent_submission_feature_id,
          parent.parent_submission_feature_id = ANY(ancestors.path)
        FROM ancestors
        JOIN submission_feature parent
          ON parent.submission_feature_id = ancestors.ancestor_id
        WHERE parent.parent_submission_feature_id IS NOT NULL
          AND parent.record_end_date IS NULL
          AND NOT ancestors.cycle
      )
      SELECT EXISTS (
        SELECT 1
        FROM ancestors
        WHERE cycle
      )
      INTO _has_cycle;

      IF _has_cycle THEN
        RAISE EXCEPTION 'Existing active submission_feature parent hierarchy contains a cycle';
      END IF;
    END;
    $$;

    --------------------------------------------------------------------------------
    -- A parent cycle can span several rows, so it has to be checked with a
    -- recursive query. The trigger is deferred so callers can move several rows
    -- around in one transaction and only validate the final shape at commit.
    --
    -- Inactive rows and root rows do not need any work. For every other row, walk
    -- up from the new parent; if we see the row being inserted or updated, the
    -- change would close a loop.
    --------------------------------------------------------------------------------

    CREATE OR REPLACE FUNCTION tr_validate_submission_feature_parent_acyclic()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    DECLARE
      _has_cycle boolean;
    BEGIN
      IF NEW.record_end_date IS NOT NULL OR NEW.parent_submission_feature_id IS NULL THEN
        RETURN NULL;
      END IF;

      WITH RECURSIVE ancestors(submission_feature_id) AS (
        SELECT NEW.parent_submission_feature_id
        UNION
        SELECT parent.parent_submission_feature_id
        FROM submission_feature parent
        JOIN ancestors
          ON ancestors.submission_feature_id = parent.submission_feature_id
        WHERE parent.parent_submission_feature_id IS NOT NULL
          AND parent.record_end_date IS NULL
      )
      SELECT EXISTS (
        SELECT 1
        FROM ancestors
        WHERE submission_feature_id = NEW.submission_feature_id
      )
      INTO _has_cycle;

      IF _has_cycle THEN
        RAISE EXCEPTION 'Cycle detected in submission_feature parent hierarchy for submission_feature_id %', NEW.submission_feature_id;
      END IF;

      RETURN NULL;
    END;
    $$;

    --------------------------------------------------------------------------------
    -- Inserts and updates can create cycles. Deletes cannot.
    --------------------------------------------------------------------------------

    CREATE CONSTRAINT TRIGGER validate_submission_feature_parent_acyclic
      AFTER INSERT OR UPDATE ON submission_feature
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION tr_validate_submission_feature_parent_acyclic();
  `);
}

/**
 * Removes deferred validation preventing active submission_feature parent cycles.
 *
 * @param {Knex} knex - Migration knex connection.
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS validate_submission_feature_parent_acyclic ON submission_feature;
    DROP FUNCTION IF EXISTS tr_validate_submission_feature_parent_acyclic();

    ALTER TABLE submission_feature
      DROP CONSTRAINT IF EXISTS submission_feature_parent_no_self_loop;
  `);
}
