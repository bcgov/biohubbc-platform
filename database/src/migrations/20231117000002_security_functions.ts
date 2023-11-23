import { Knex } from 'knex';

/**
 * Add functions:
 * - evaluate_security_string_condition
 * - evaluate_security_number_condition
 * - evaluate_security_rule
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ----------------------------------------------------------------------------------------
    -- Create functions
    ----------------------------------------------------------------------------------------
    set search_path=biohub,public;

    -- Executes a single security_string condition against the provided submission_feature_id
    -- Note: Returns true if the condition hit (applied).
    CREATE OR REPLACE FUNCTION evaluate_security_string_condition(rule_name VARCHAR, submission_feature_id integer)
    RETURNS TABLE (result boolean) 
    language plpgsql
    SET client_min_messages = warning
    AS $$
    DECLARE
        comp TEXT;  
        val text;
    BEGIN
        SELECT security_string.comparator, security_string.value INTO comp, val FROM security_string WHERE name = evaluate_security_string_condition.rule_name;

        RETURN QUERY EXECUTE format('SELECT CASE WHEN EXISTS (SELECT 1 FROM search_string WHERE submission_feature_id = %s AND value %s ''%s'') THEN TRUE ELSE FALSE END', evaluate_security_string_condition.submission_feature_id, comp, val);
    END;
    $$;

    -- Executes a single security_number condition against the provided submission_feature_id
    -- Note: Returns true if the condition hit (applied).
    CREATE OR REPLACE FUNCTION evaluate_security_number_condition(rule_name VARCHAR, submission_feature_id integer)
    RETURNS TABLE (result boolean) 
    language plpgsql
    SET client_min_messages = warning
    AS $$
    DECLARE
        comparator TEXT;  
        value numeric;
    BEGIN
        SELECT security_number.comparator, security_number.value INTO comparator, value FROM security_number WHERE name = evaluate_security_number_condition.rule_name;

        RETURN QUERY EXECUTE format('SELECT CASE WHEN EXISTS (SELECT 1 FROM search_number WHERE submission_feature_id = %s AND value %s %s) THEN TRUE ELSE FALSE END', evaluate_security_number_condition.submission_feature_id, comparator, value);
    END;
    $$;

    -- Executes a single security_spatial condition against the provided submission_feature_id
    -- Note: Returns true if the condition hit (applied).
    -- Note: SRID of both geometries must be the same (prefer 4326)
    CREATE OR REPLACE FUNCTION evaluate_security_spatial_condition(rule_name VARCHAR, submission_feature_id integer)
    RETURNS TABLE (result BOOLEAN) 
    language plpgsql
    set client_min_messages = warning
    AS $$
    DECLARE
        comparator TEXT;  
        value geometry;
    BEGIN
        SELECT security_spatial.comparator, security_spatial.value INTO comparator, value FROM security_spatial WHERE name = evaluate_security_spatial_condition.rule_name;
    
        RETURN QUERY EXECUTE FORMAT('SELECT CASE WHEN EXISTS (SELECT 1 FROM search_spatial WHERE submission_feature_id = %s AND ST_Intersects(value, ''%s'')) THEN TRUE ELSE FALSE END', evaluate_security_spatial_condition.submission_feature_id, value);
    END;
    $$;
    
    -- Executes all security rules against the provided submission_feature_id
    -- Note: Returns a list of security rules and a boolean indicating if ALL conditions under that rule hit (applied).
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

    -- Executes all security rules against the provided submission_feature_id
    -- Note: This is an alternate version to 'evaluate_security_rule' that includes the names of the conditions that hit/missed (applied/didn't apply).
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

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
