import type { Knex } from 'knex';

/**
 * Drop the `journal_*` triggers from the high-volume submission feature tables.
 *
 * `tr_journal_trigger` is an AFTER trigger that copies the full old and new row into `audit_log` on
 * every insert, update, and delete. The submission feature table and its property, relationship,
 * artifact, error, and security tables are written in large batches during ingestion, indexing,
 * closure generation, and security screening, so journaling them roughly doubles the write volume
 * of every batch and grows `audit_log` at the rate of the data itself. That history is not read by
 * anything: no operational or application path consults `audit_log` for these rows.
 *
 * Only the `journal_*` triggers are dropped. The `audit_*` triggers stay in place: `tr_audit_trigger`
 * is a BEFORE trigger that maintains `create_user`, `update_user`, `update_date`, and enforces the
 * `revision_count` concurrency check, so the audit columns on these tables continue to behave as
 * before. The `validate_submission_feature_property_assignment` triggers on the property tables are
 * likewise untouched.
 *
 * The fully derived tables (`submission_feature_closure`, `security_scope_anchor`,
 * `team_security_scope`) were created without journal triggers for the same reason and need no
 * change here. Journaling remains on the low-volume configuration tables (`feature_type`,
 * `feature_property`, `security_rule`, `policy`, `team`, and the rest) where a row-level history is
 * cheap and useful.
 *
 * `DROP TRIGGER` takes an ACCESS EXCLUSIVE lock on its table for the duration of the statement,
 * which is momentary; the migration runs as one transaction so all fourteen locks are released
 * together on commit.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_submission_feature ON submission_feature;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_string ON submission_feature_property_string;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_number ON submission_feature_property_number;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_boolean ON submission_feature_property_boolean;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_timestamp ON submission_feature_property_timestamp;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_code ON submission_feature_property_code;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_taxon ON submission_feature_property_taxon;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_geometry ON submission_feature_property_geometry;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_feature ON submission_feature_property_feature;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_artifact ON submission_feature_property_artifact;
    DROP TRIGGER IF EXISTS journal_submission_feature_feature ON submission_feature_feature;
    DROP TRIGGER IF EXISTS journal_submission_feature_artifact ON submission_feature_artifact;
    DROP TRIGGER IF EXISTS journal_submission_feature_error ON submission_feature_error;
    DROP TRIGGER IF EXISTS journal_submission_feature_security ON submission_feature_security;
  `);
}

/**
 * Restore the `journal_*` triggers on the high-volume submission feature tables.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE TRIGGER journal_submission_feature
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER journal_submission_feature_property_string
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_string
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER journal_submission_feature_property_number
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_number
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER journal_submission_feature_property_boolean
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_boolean
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER journal_submission_feature_property_timestamp
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_timestamp
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER journal_submission_feature_property_code
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_code
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER journal_submission_feature_property_taxon
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_taxon
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER journal_submission_feature_property_geometry
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_geometry
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER journal_submission_feature_property_feature
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER journal_submission_feature_property_artifact
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER journal_submission_feature_feature
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER journal_submission_feature_artifact
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER journal_submission_feature_error
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_error
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER journal_submission_feature_security
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_security
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}
