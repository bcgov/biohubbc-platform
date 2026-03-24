import { Knex } from 'knex';

/**
 * Create persistent GeoJSON parsing helper used by submission feature ingestion.
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
