import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { BaseRepository } from './base-repository';

export const TaxonRecord = z.object({
  taxon_id: z.number(),
  itis_tsn: z.number(),
  bc_taxon_code: z.string().nullable(),
  itis_scientific_name: z.string(),
  common_name: z.string().nullable(),
  itis_data: z.record(z.any()),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});

export type TaxonRecord = z.infer<typeof TaxonRecord>;

/**
 * Taxonomy Repository
 *
 * @export
 * @class TaxonomyRepository
 * @extends {BaseRepository}
 */
export class TaxonomyRepository extends BaseRepository {
  /**
   * Get taxon records by TSN id.
   *
   * @param {number[]} tsnIds
   * @return {*}  {Promise<TaxonRecord>}
   * @memberof TaxonomyRepository
   */
  async getTaxonByTsnIds(tsnIds: number[]): Promise<TaxonRecord[]> {
    const queryBuilder = getKnex().queryBuilder().select('*').from('taxon').whereIn('itis_tsn', tsnIds);

    const response = await this.connection.knex(queryBuilder, TaxonRecord);

    return response.rows;
  }

  /**
   * Insert a new taxon record.
   *
   * @param {number} itisTsn
   * @param {(string | null)} [bcTaxonCode=null]
   * @param {string} itisScientificName
   * @param {string} commonName
   * @param {Record<any, any>} itisData
   * @param {string} itisUpdateDate
   * @return {*}  {Promise<TaxonRecord>}
   * @memberof TaxonomyRepository
   */
  async addItisTaxonRecord(
    itisTsn: number,
    itisScientificName: string,
    commonName: string | null,
    itisData: Record<any, any>,
    itisUpdateDate: string
  ): Promise<TaxonRecord> {
    const sqlStatement = SQL`
      INSERT INTO
        taxon
      (
        itis_tsn,
        itis_scientific_name,
        common_name,
        itis_data,
        itis_update_date
      )
      VALUES (
        ${itisTsn},
        ${itisScientificName},
        ${commonName},
        ${itisData},
        ${itisUpdateDate}
      )
      RETURNING
        *;
    `;

    const response = await this.connection.sql(sqlStatement, TaxonRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert new taxon record', [
        'TaxonomyRepository->addItisTaxonRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Delete an existing taxon record.
   *
   * @param {number} taxonId
   * @memberof TaxonomyRepository
   */
  async deleteTaxonRecord(taxonId: number) {
    const sqlStatement = SQL`
      DELETE FROM
        taxon
      WHERE
        taxon_id = ${taxonId}
      RETURNING
        *;
    `;

    await this.connection.sql(sqlStatement);
  }
}
