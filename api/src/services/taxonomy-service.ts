import { IDBConnection } from '../database/db';
import { TaxonomyRepository, TaxonRecord } from '../repositories/taxonomy-repository';
import { ItisService, ItisSolrSearchResponse } from './itis-service';

export interface ITaxonomySource {
  unit_name1: string;
  unit_name2: string;
  unit_name3: string;
  taxon_authority: string;
  code: string;
  tty_kingdom: string;
  tty_name: string;
  english_name: string;
  note: string | null;
  end_date: string | null;
  parent_id: number | null;
  parent_hierarchy: { id: number; level: string }[];
}

export type TaxonSearchResult = {
  tsn: number;
  label: string;
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
    // Search for taxon records in the database
    const existingTaxonRecords = await this.taxonRepository.getTaxonByTsnIds(tsnIds);

    const missingTsnIds = tsnIds.filter((tsnId) => !existingTaxonRecords.find((item) => item.itis_tsn === tsnId));

    if (missingTsnIds.length) {
      // If the local database does not contain a record for all of the requested ids, search ITIS for the missing
      // taxon records, patching the missing records in the local database in the process
      const itisService = new ItisService();
      const itisResponse = await itisService.searchItisByTSN(missingTsnIds);

      for (const itisRecord of itisResponse) {
        // Add the taxon record to the database
        const newTaxonRecord = await this.addItisTaxonRecord(itisRecord);
        existingTaxonRecords.push(newTaxonRecord);
      }
    }

    // Missing ids patched, return taxon records for all requested ids
    return this._sanitizeTaxonRecordsData(existingTaxonRecords);
  }

  _sanitizeTaxonRecordsData(taxonRecords: TaxonRecord[]): TaxonSearchResult[] {
    return taxonRecords.map((item: TaxonRecord) => {
      return {
        tsn: item.itis_tsn,
        label: item.common_name || item.itis_scientific_name,
        scientificName: item.itis_scientific_name
      };
    });
  }

  /**
   * Adds a new taxon record.
   *
   * @param {ItisSolrSearchResponse} itisSolrResponse
   * @return {*}  {Promise<TaxonRecord>}
   * @memberof TaxonomyService
   */
  async addItisTaxonRecord(itisSolrResponse: ItisSolrSearchResponse): Promise<TaxonRecord> {
    let commonName = null;
    if (itisSolrResponse.commonNames) {
      commonName = itisSolrResponse.commonNames && itisSolrResponse.commonNames[0].split('$')[1];
    }

    return this.taxonRepository.addItisTaxonRecord(
      Number(itisSolrResponse.tsn),
      itisSolrResponse.scientificName,
      commonName,
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
