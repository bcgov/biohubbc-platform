import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import {
  AddItisTaxonRecord,
  FindTaxonFilters,
  TaxonParentLinkRecord,
  TaxonRankPatchRecord,
  TaxonRecord
} from '../models/taxon';
import { getLogger } from '../utils/logger';
import { BaseRepository } from './base-repository';

const defaultLog = getLogger('repositories/taxonomy-repository');

const taxonRecordColumns = [
  'taxon_id',
  'itis_tsn',
  'parent_itis_tsn',
  'parent_taxon_id',
  'bc_taxon_code',
  'itis_scientific_name',
  'rank',
  'common_name',
  'itis_data',
  'itis_update_date'
];

/**
 * Taxonomy Repository
 *
 * @export
 * @class TaxonomyRepository
 * @extends {BaseRepository}
 */
export class TaxonomyRepository extends BaseRepository {
  /**
   * Find taxon records by TSN id.
   *
   * @param {number[]} tsnIds
   * @return {*}  {Promise<TaxonRecord[]>}
   * @memberof TaxonomyRepository
   */
  async findTaxonByTsnIds(tsnIds: number[]): Promise<TaxonRecord[]> {
    if (!tsnIds.length) {
      return [];
    }

    const queryBuilder = getKnex()
      .queryBuilder()
      .select(taxonRecordColumns)
      .from('taxon')
      .whereIn('itis_tsn', tsnIds)
      .whereNull('record_end_date');

    const response = await this.connection.knex(queryBuilder, TaxonRecord);

    return response.rows;
  }

  /**
   * Find active taxon records matching a TSN or scientific name.
   *
   * Supplied values are matched directly against `itis_tsn` or, case-insensitively, against `itis_scientific_name`.
   * Callers should treat an empty result as "not found".
   *
   * @param {FindTaxonFilters} filters
   * @return {*}  {Promise<TaxonRecord[]>}
   * @memberof TaxonomyRepository
   */
  async findTaxon(filters: FindTaxonFilters): Promise<TaxonRecord[]> {
    if (filters.itis_tsn === undefined && filters.itis_scientific_name === undefined) {
      return [];
    }

    const queryBuilder = getKnex()
      .queryBuilder()
      .select(taxonRecordColumns)
      .from('taxon')
      .whereNull('record_end_date')
      .where((query) => {
        if (filters.itis_tsn !== undefined) {
          query.where('itis_tsn', filters.itis_tsn);
        }

        if (filters.itis_scientific_name !== undefined) {
          query.orWhereRaw('LOWER(itis_scientific_name) = LOWER(?)', [filters.itis_scientific_name]);
        }
      });

    const response = await this.connection.knex(queryBuilder, TaxonRecord);

    return response.rows;
  }

  /**
   * Insert or reuse multiple taxon records.
   *
   * @param {AddItisTaxonRecord[]} records
   * @return {*}  {Promise<TaxonRecord[]>}
   * @memberof TaxonomyRepository
   */
  async insertTaxonRecords(records: AddItisTaxonRecord[]): Promise<TaxonRecord[]> {
    if (!records.length) {
      return [];
    }

    defaultLog.debug({ label: 'insertTaxonRecords', count: records.length });

    const sqlStatement = SQL`
      WITH input_rows AS (
        SELECT *
        FROM jsonb_to_recordset(${JSON.stringify(records)}::jsonb) AS input_row(
          itis_tsn integer,
          itis_scientific_name text,
          rank text,
          common_name text,
          itis_data jsonb,
          itis_update_date timestamptz
        )
      ),
      inserted_rows AS (
        INSERT INTO
          taxon 
        (
          itis_tsn,
          itis_scientific_name,
          rank,
          common_name,
          itis_data,
          itis_update_date
        )
        SELECT
          itis_tsn,
          itis_scientific_name,
          rank,
          common_name,
          itis_data,
          itis_update_date
        FROM input_rows
        ON CONFLICT
        DO NOTHING
        RETURNING
          taxon_id,
          itis_tsn,
          parent_itis_tsn,
          parent_taxon_id,
          bc_taxon_code,
          itis_scientific_name,
          rank,
          common_name,
          itis_data,
          itis_update_date
      )
      SELECT
        taxon_id,
        itis_tsn,
        parent_itis_tsn,
        parent_taxon_id,
        bc_taxon_code,
        itis_scientific_name,
        rank,
        common_name,
        itis_data,
        itis_update_date
      FROM inserted_rows
      UNION ALL
      SELECT
        taxon_id,
        itis_tsn,
        parent_itis_tsn,
        parent_taxon_id,
        bc_taxon_code,
        itis_scientific_name,
        rank,
        common_name,
        itis_data,
        itis_update_date
      FROM taxon
      WHERE taxon.itis_tsn IN (SELECT itis_tsn FROM input_rows)
        AND taxon.record_end_date IS null;
    `;

    const response = await this.connection.sql(sqlStatement, TaxonRecord);

    return response.rows;
  }

  /**
   * Patch missing rank on existing taxon rows.
   *
   * This intentionally does not upsert: callers use `insertTaxonRecords` for new taxa, then patch
   * incomplete cached rows that predate the first-class `rank` column.
   *
   * @param {TaxonRankPatchRecord[]} records
   * @return {*}  {Promise<void>}
   * @memberof TaxonomyRepository
   */
  async patchTaxonRanks(records: TaxonRankPatchRecord[]): Promise<void> {
    if (!records.length) {
      return;
    }

    const sqlStatement = SQL`
      WITH input_rows AS (
        SELECT *
        FROM jsonb_to_recordset(${JSON.stringify(records)}::jsonb) AS input_row(
          itis_tsn integer,
          rank text
        )
      )
      UPDATE taxon
      SET rank = input_rows.rank
      FROM input_rows
      WHERE taxon.itis_tsn = input_rows.itis_tsn
        AND taxon.record_end_date IS NULL
        AND taxon.rank IS DISTINCT FROM input_rows.rank;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Set `parent_itis_tsn` and resolve `parent_taxon_id` for a batch of taxa.
   *
   * @param {TaxonParentLinkRecord[]} records
   * @return {*}  {Promise<void>}
   * @memberof TaxonomyRepository
   */
  async updateTaxonParentLinks(records: TaxonParentLinkRecord[]): Promise<void> {
    if (!records.length) {
      return;
    }

    const sqlStatement = SQL`
      WITH input_rows AS (
        SELECT *
        FROM jsonb_to_recordset(${JSON.stringify(records)}::jsonb) AS input_row(
          itis_tsn integer,
          parent_itis_tsn integer
        )
      )
      UPDATE taxon AS child
      SET
        parent_itis_tsn = input_rows.parent_itis_tsn,
        parent_taxon_id = parent.taxon_id
      FROM input_rows
      LEFT JOIN taxon AS parent
        ON parent.itis_tsn = input_rows.parent_itis_tsn
       AND parent.record_end_date IS NULL
      WHERE child.itis_tsn = input_rows.itis_tsn
        AND child.record_end_date IS NULL
        AND (
          child.parent_itis_tsn IS DISTINCT FROM input_rows.parent_itis_tsn
          OR child.parent_taxon_id IS DISTINCT FROM parent.taxon_id
        );
    `;

    await this.connection.sql(sqlStatement);
  }
}
