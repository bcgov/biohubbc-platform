import { Knex } from 'knex';

/**
 * Creates a trigger that inserts a URN into the urn table after a submission_feature is inserted.
 *
 * URN format: urn:<submission_id>:<feature_type>:<feature_id>
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path = 'biohub';

    CREATE OR REPLACE FUNCTION biohub.tr_submission_feature_urn()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY invoker
    AS $function$
      BEGIN
        INSERT INTO biohub.urn (urn)
        VALUES (
          CONCAT(
            'urn:',
            NEW.submission_id, ':',
            NEW.feature_type, ':',
            NEW.feature_id
          )
        );

        RETURN NEW;
      END;
    $function$;

    DROP TRIGGER IF EXISTS insert_submission_feature_urn ON biohub.submission_feature;

    CREATE TRIGGER insert_submission_feature_urn
    AFTER INSERT ON biohub.submission_feature
    FOR EACH ROW
    EXECUTE PROCEDURE biohub.tr_submission_feature_urn();
  `);
}
