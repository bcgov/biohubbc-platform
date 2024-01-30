import SQL from 'sql-template-strings';
import { z } from 'zod';
import { ApiExecuteSQLError } from '../errors/api-error';
import { BaseRepository } from './base-repository';

export const ItisTaxonRecord = z.object({
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

export type ItisTaxonRecord = z.infer<typeof ItisTaxonRecord>;

/**
 * Taxonomy Repository
 *
 * @export
 * @class TaxonomyRepository
 * @extends {BaseRepository}
 */
export class TaxonomyRepository extends BaseRepository {
  /**
   * Gets a taxon record by its taxon id.
   *
   * @param {number[]} tsnIds
   * @return {*}  {Promise<ItisTaxonRecord>}
   * @memberof TaxonomyRepository
   */
  async getTaxonByTsnIds(tsnIds: number[]): Promise<ItisTaxonRecord[]> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        taxon
      WHERE
        itis_tsn IN (${tsnIds});
    `;

    const response = await this.connection.sql(sqlStatement, ItisTaxonRecord);

    if (response.rowCount === 0) {
      throw new ApiExecuteSQLError('Failed to get taxon by tsn', [
        'TaxonomyRepository->getTaxonByTsnIds',
        'rowCount was null or undefined, expected rowCount > 0'
      ]);
    }

    return response.rows;
  }

  /**
   * inserts a new taxon record.
   *
   * @param {number} itisTsn
   * @param {string} bcTaxonCode
   * @param {string} itisScientificName
   * @param {string} commonName
   * @param {Record<any, any>} itisData
   * @param {string} itisUpdateDate
   * @return {*}  {Promise<ItisTaxonRecord>}
   * @memberof TaxonomyRepository
   */
  async addItisTaxonRecord(
    itisTsn: number,
    bcTaxonCode: string,
    itisScientificName: string,
    commonName: string,
    itisData: Record<any, any>,
    itisUpdateDate: string
  ): Promise<ItisTaxonRecord> {
    const sqlStatement = SQL`
      INSERT INTO
        taxon
      (
        itis_tsn,
        bc_taxon_code,
        itis_scientific_name,
        common_name,
        itis_data,
        itis_update_date
      )
      VALUES (
        ${itisTsn},
        ${bcTaxonCode},
        ${itisScientificName},
        ${commonName},
        ${itisData},
        ${itisUpdateDate}
      )
      RETURNING
        *;
    `;

    const response = await this.connection.sql(sqlStatement, ItisTaxonRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert new taxon record', [
        'TaxonomyRepository->addItisTaxonRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * deletes an existing taxon record.
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
