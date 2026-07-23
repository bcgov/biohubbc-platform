import { Knex } from 'knex';

const DB_USER_MARTIN = process.env.DB_USER_MARTIN || 'martin';

/**
 * Escape a value for embedding as a SQL string literal inside the dollar-quoted DO block below.
 *
 * @param {string} value
 * @return {*}  {string}
 */
const escapeLiteral = (value: string): string => value.replace(/'/g, `''`);

/**
 * Create the Martin fixture vector tile function.
 *
 * This is a harmless, synthetic tile source used to validate the tile serving stack (Martin, the
 * authenticating tile gateway, the OpenShift route) end to end, independently of any real data. It
 * renders a one degree grid of points covering British Columbia.
 *
 * It deliberately reads NO tables. The function runs as SECURITY INVOKER, so it executes as the
 * `martin` role, which holds no table privileges by design. Reading a table here would either fail or
 * require weakening that role.
 *
 * The GRANT is re-applied on every deploy because seeds in `procedures` run in all environments. That
 * matters in TEST/PROD, where the Crunchy cutover restores with `pg_restore --no-acl` and drops both
 * the REVOKE and the GRANT.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path = biohub, public;

    CREATE OR REPLACE FUNCTION biohub.tile_fixture(z integer, x integer, y integer)
    RETURNS bytea
    LANGUAGE sql
    STABLE
    PARALLEL SAFE
    AS $fn$
      WITH tile AS (
        -- Tile envelope in Web Mercator, and the same envelope in WGS84 to filter against.
        SELECT
          public.ST_TileEnvelope(z, x, y) AS envelope_3857,
          public.ST_Transform(public.ST_TileEnvelope(z, x, y), 4326) AS envelope_4326
      ),
      grid AS (
        -- Synthetic one degree point grid roughly covering British Columbia. No tables are read.
        SELECT
          lng,
          lat,
          public.ST_SetSRID(public.ST_MakePoint(lng, lat), 4326) AS geometry
        FROM generate_series(-139, -114) AS lng,
             generate_series(48, 60) AS lat
      ),
      mvt_rows AS (
        SELECT
          public.ST_AsMVTGeom(
            public.ST_Transform(grid.geometry, 3857),
            tile.envelope_3857,
            4096,
            64,
            true
          ) AS geom,
          grid.lng AS longitude,
          grid.lat AS latitude
        FROM grid, tile
        WHERE grid.geometry && tile.envelope_4326
      )
      -- ST_AsMVT returns a zero length bytea (NOT NULL) when nothing matches. Normalize that to
      -- NULL so Martin unambiguously serves an empty tile (204) rather than a 0 byte body.
      SELECT NULLIF(public.ST_AsMVT(mvt_rows.*, 'fixture', 4096, 'geom'), ''::bytea)
      FROM mvt_rows
      WHERE mvt_rows.geom IS NOT NULL;
    $fn$;

    -- Martin parses the function comment as TileJSON metadata and logs a warning if it is not
    -- valid JSON, so the description is provided as a TileJSON fragment rather than prose.
    COMMENT ON FUNCTION biohub.tile_fixture(integer, integer, integer) IS
      '{"description": "Synthetic vector tile source used to validate the Martin tile stack end to end. Renders a one degree point grid over British Columbia and reads no tables."}';

    DO $grants$
    DECLARE
      v_role_name text := '${escapeLiteral(DB_USER_MARTIN)}';
    BEGIN
      -- CREATE FUNCTION grants EXECUTE to PUBLIC by default. Revoke it, then grant explicitly.
      REVOKE ALL ON FUNCTION biohub.tile_fixture(integer, integer, integer) FROM PUBLIC;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role_name) THEN
        EXECUTE format(
          'GRANT EXECUTE ON FUNCTION biohub.tile_fixture(integer, integer, integer) TO %I',
          v_role_name
        );
      ELSE
        RAISE WARNING 'Role % does not exist, skipping tile_fixture grant.', v_role_name;
      END IF;
    END
    $grants$;
  `);
}
