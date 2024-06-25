import { IDBConnection } from '../database/db';
import { TaxonomyRepository, TaxonRecord } from '../repositories/taxonomy-repository';
import { getItisTaxonCommonNames } from '../utils/itis-utils';
import { getLogger } from '../utils/logger';
import { ItisService, ItisSolrSearchResponse } from './itis-service';

const defaultLog = getLogger('services/taxonomy-service');

export type TaxonSearchResult = {
  tsn: number;
  commonNames: string[];
  scientificName: string;
};

/**
 * Service for retrieving and processing taxonomic data from BioHub.
 *
 * @export
 * @class TaxonomyService
 */
export class TaxonomyService {
  taxonRepository: TaxonomyRepository;

  constructor(connection: IDBConnection) {
    this.taxonRepository = new TaxonomyRepository(connection);
  }

  /**
   * Get taxon records by TSN ids.
   *
   * @param {number[]} tsnIds
   * @return {*}  {Promise<TaxonSearchResult[]>}
   * @memberof TaxonomyService
   */
  async getTaxonByTsnIds(tsnIds: number[]): Promise<TaxonSearchResult[]> {
    defaultLog.debug({ label: 'getTaxonByTsnIds', tsnIds });

    // Search for taxon records in the database
    const existingTaxonRecords = await this.taxonRepository.getTaxonByTsnIds(tsnIds);
    const existingTsnIds = existingTaxonRecords.map((record) => record.itis_tsn);

    const missingTsnIds = tsnIds.filter((tsnId) => !existingTsnIds.includes(tsnId));

    let patchedTaxonRecords: TaxonRecord[] = [];

    if (missingTsnIds.length) {
      // If the local database does not contain a record for all of the requested ids, search ITIS for the missing
      // taxon records, patching the missing records in the local database in the process
      const itisService = new ItisService();
      const itisResponse = await itisService.searchItisByTSN(missingTsnIds);

      patchedTaxonRecords = await Promise.all(itisResponse.map(async (item) => this.addItisTaxonRecord(item)));
    }

    // Missing ids patched, return taxon records for all requested ids
    return this._sanitizeTaxonRecordsData(existingTaxonRecords.concat(patchedTaxonRecords));
  }

  _sanitizeTaxonRecordsData(taxonRecords: TaxonRecord[]): TaxonSearchResult[] {
    return taxonRecords.map((item: TaxonRecord) => ({
      tsn: item.itis_tsn,
      // TODO: wrap commonNames in array until the database supports multiple common names
      commonNames: item?.common_name ? [item.common_name] : [],
      scientificName: item.itis_scientific_name
    }));
  }

  /**
   * Adds a new taxon record.
   *
   * @param {ItisSolrSearchResponse} itisSolrResponse
   * @return {*}  {Promise<TaxonRecord>}
   * @memberof TaxonomyService
   */
  async addItisTaxonRecord(itisSolrResponse: ItisSolrSearchResponse): Promise<TaxonRecord> {
    const commonNames = getItisTaxonCommonNames(itisSolrResponse?.commonNames);

    return this.taxonRepository.addItisTaxonRecord(
      Number(itisSolrResponse.tsn),
      itisSolrResponse.scientificName,
      commonNames,
      itisSolrResponse,
      itisSolrResponse.updateDate
    );
  }

  /**
   * Delete an existing taxon record.
   *
   * @param {number} taxonId
   * @return {*}  {Promise<void>}
   * @memberof TaxonomyService
   */
  async deleteTaxonRecord(taxonId: number): Promise<void> {
    return this.taxonRepository.deleteTaxonRecord(taxonId);
  }
}
