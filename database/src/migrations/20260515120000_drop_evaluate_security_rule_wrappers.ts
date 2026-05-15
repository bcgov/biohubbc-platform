import { Knex } from 'knex';

/**
 * Drops the `evaluate_security_rule` and `evaluate_security_rule_2` wrappers.
 *
 * Their inner dependencies (`evaluate_security_*_condition` functions and
 * `search_*` tables) were already removed in the preceding `drop_search_tables`
 * migration, leaving the wrappers parsable but uncallable. Removing them
 * eliminates dead schema that could mislead future readers into thinking it's
 * part of the live security-rule evaluation path (the live path is
 * `security_rule_expression`-based).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP FUNCTION IF EXISTS evaluate_security_rule(integer);
    DROP FUNCTION IF EXISTS evaluate_security_rule_2(integer);
  `);
}

/**
 * Recreates both wrappers verbatim from their original definitions so that a
 * full rollback chain — this migration's `down()` followed by
 * `drop_search_tables`'s `down()` — restores a working set. Rolling back only
 * this migration recreates the wrappers but they remain uncallable until the
 * inner condition functions and `search_*` tables are also restored. This is
 * the expected sequencing; the wrappers and their dependencies were always
 * meant to roll back together.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- Bodies copied verbatim from the original creation migration. Reformatting
    -- or 'cleaning up' would cause silent behavior drift on rollback.

    CREATE OR REPLACE FUNCTION evaluate_security_rule(submission_feature_id integer)
    RETURNS TABLE (result boolean, security_rule_id integer)
    language plpgsql
    set client_min_messages = warning
    AS $$
    begin
        return QUERY (
            select bool_and(r1.result) result, r1.security_rule_id from (
                (select bool_and(ex1.result) result, s1.security_rule_id from security_string s1, lateral evaluate_security_string_condition(s1.name, evaluate_security_rule.submission_feature_id) ex1 group by s1.security_rule_id)
                union ALL
                (select bool_and(ex2.result) result, s2.security_rule_id from security_number s2, lateral evaluate_security_number_condition(s2.name, evaluate_security_rule.submission_feature_id) ex2 group by s2.security_rule_id)
                union ALL
                (select bool_and(ex3.result) result, s3.security_rule_id from security_datetime s3, lateral evaluate_security_datetime_condition(s3.name, evaluate_security_rule.submission_feature_id) ex3 group by s3.security_rule_id)
                union ALL
                (select bool_and(ex3.result) result, s3.security_rule_id from security_spatial s3, lateral evaluate_security_spatial_condition(s3.name, evaluate_security_rule.submission_feature_id) ex3 group by s3.security_rule_id)
            ) r1 group by r1.security_rule_id
        );
    END;
    $$;

    CREATE OR REPLACE FUNCTION evaluate_security_rule_2(submission_feature_id integer)
    RETURNS TABLE (result boolean, security_rule_id integer, security_condition_name varchar)
    language plpgsql
    set client_min_messages = warning
    AS $$
    begin
        return QUERY (
            (select bool_and(ex1.result) result, s1.security_rule_id, s1.name security_condition_name from security_string s1, lateral evaluate_security_string_condition(s1.name, evaluate_security_rule_2.submission_feature_id) ex1 group by s1.security_rule_id, s1.name)
            union ALL
            (select bool_and(ex2.result) result, s2.security_rule_id, s2.name security_condition_name from security_number s2, lateral evaluate_security_number_condition(s2.name, evaluate_security_rule_2.submission_feature_id) ex2 group by s2.security_rule_id, s2.name)
            union ALL
            (select bool_and(ex3.result) result, s3.security_rule_id, s3.name security_condition_name from security_datetime s3, lateral evaluate_security_datetime_condition(s3.name, evaluate_security_rule_2.submission_feature_id) ex3 group by s3.security_rule_id, s3.name)
            union ALL
            (select bool_and(ex3.result) result, s3.security_rule_id, s3.name security_condition_name from security_spatial s3, lateral evaluate_security_spatial_condition(s3.name, evaluate_security_rule_2.submission_feature_id) ex3 group by s3.security_rule_id, s3.name)
        );
    END;
    $$;
  `);
}
