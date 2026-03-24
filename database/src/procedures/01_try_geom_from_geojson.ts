import { Knex } from 'knex';

/**
 * Tries to transform GeoJSON to a postgis geom, and returns null upon failure.
 * Used for validating that a value is valid GeoJSON.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path = biohub, public;

    CREATE OR REPLACE FUNCTION biohub.try_geom_from_geojson(geojson_text text)
    RETURNS geometry
    LANGUAGE plpgsql
    IMMUTABLE
    STRICT
    AS $fn$
    BEGIN
      RETURN public.ST_GeomFromGeoJSON(geojson_text);
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
    $fn$;
  `);
}
