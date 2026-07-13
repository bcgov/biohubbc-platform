import { Knex } from 'knex';

/**
 * Add explicit ITIS rank and parent-child hierarchy fields to `taxon`.
 *
 * Adds:
 * - `rank`            (nullable varchar)   — ITIS taxonomic rank.
 * - `parent_itis_tsn` (nullable integer)   — ITIS TSN of the immediate parent taxon.
 * - `parent_taxon_id`  (nullable integer)  — Self-referencing FK to the immediate parent taxon row.
 *
 * Existing taxon rows are left unresolved. Taxon ingestion derives `rank` from the ITIS taxon payload,
 * derives `parent_itis_tsn` from the ordered ITIS `hierarchyTSN` lineage, and repairs missing parent
 * links lazily when taxa are encountered.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Add rank and parent hierarchy columns
    ----------------------------------------------------------------------------------------
    ALTER TABLE taxon ADD COLUMN IF NOT EXISTS rank varchar(50);
    ALTER TABLE taxon ADD COLUMN IF NOT EXISTS parent_itis_tsn integer;
    ALTER TABLE taxon ADD COLUMN IF NOT EXISTS parent_taxon_id integer;

    ALTER TABLE taxon ADD CONSTRAINT taxon_parent_taxon_fk FOREIGN KEY (parent_taxon_id) REFERENCES taxon(taxon_id);

    COMMENT ON COLUMN taxon.rank IS 'ITIS taxonomic rank, populated from ITIS response.';
    COMMENT ON COLUMN taxon.parent_itis_tsn IS 'ITIS TSN of the immediate parent taxon, derived from the ordered ITIS hierarchyTSN lineage.';
    COMMENT ON COLUMN taxon.parent_taxon_id IS 'Foreign key to the immediate parent taxon row (self-reference), resolved from parent_itis_tsn.';

    ----------------------------------------------------------------------------------------
    -- Add hierarchy lookup indexes
    ----------------------------------------------------------------------------------------
    CREATE INDEX IF NOT EXISTS taxon_parent_itis_tsn_idx ON taxon(parent_itis_tsn);
    CREATE INDEX IF NOT EXISTS taxon_parent_taxon_id_idx ON taxon(parent_taxon_id);
  `);
}

/**
 * Drop the taxon parent hierarchy fields, constraint, and indexes.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS taxon_parent_taxon_id_idx;
    DROP INDEX IF EXISTS taxon_parent_itis_tsn_idx;

    ALTER TABLE taxon DROP CONSTRAINT IF EXISTS taxon_parent_taxon_fk;
    ALTER TABLE taxon DROP COLUMN IF EXISTS parent_taxon_id;
    ALTER TABLE taxon DROP COLUMN IF EXISTS parent_itis_tsn;
    ALTER TABLE taxon DROP COLUMN IF EXISTS rank;
  `);
}
