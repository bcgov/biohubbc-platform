import { IDBConnection } from '../database/db';
import { ItisTaxonRecord, TaxonomyRepository } from '../repositories/taxonomy-repository';
import { ItisService } from './itis-service';

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

export interface IItisSearchResponse {
  commonNames: string[];
  kingdom: string;
  name: string;
  parentTSN: string;
  scientificName: string;
  tsn: string;
  updateDate: string;
  usage: string;
}

export interface IItisSearchResult {
  tsn: number;
  label: string;
  scientificName: string;
}

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
   * @return {*}  {Promise<IItisSearchResult[]>}
   * @memberof TaxonomyService
   */
  async getTaxonByTsnIds(tsnIds: number[]): Promise<IItisSearchResult[]> {
    // Search for taxon records in the database
    const taxon = await this.taxonRepository.getTaxonByTsnIds(tsnIds);

    // If taxon records are found, return them
    if (taxon.length > 0) {
      return this._sanitizeTaxonRecordsData(taxon);
    }

    // If no taxon records are found, search ITIS for the taxon records
    const itisService = new ItisService();
    const itisResponse = await itisService.searchItisByTSN(tsnIds);

    const taxonRecords: ItisTaxonRecord[] = [];
    for (const itisRecord of itisResponse) {
      // Add the taxon record to the database
      const taxonRecord = await this.addItisTaxonRecord(itisRecord);
      taxonRecords.push(taxonRecord);
    }

    // Return the taxon records
    return this._sanitizeTaxonRecordsData(taxonRecords);
  }

  _sanitizeTaxonRecordsData(itisData: ItisTaxonRecord[]): IItisSearchResult[] {
    return itisData.map((item: ItisTaxonRecord) => {
      return {
        tsn: item.itis_tsn,
        label: item.common_name || item.itis_scientific_name,
        scientificName: item.itis_scientific_name
      } as IItisSearchResult;
    });
  }

  /**
   * Adds a new taxon record.
   *
   * @param {IItisSearchResponse} itisResponse
   * @return {*}  {Promise<ItisTaxonRecord>}
   * @memberof TaxonomyService
   */
  async addItisTaxonRecord(itisResponse: IItisSearchResponse): Promise<ItisTaxonRecord> {
    let commonName = null;
    if (itisResponse.commonNames) {
      commonName = itisResponse.commonNames && itisResponse.commonNames[0].split('$')[1];
    }

    return this.taxonRepository.addItisTaxonRecord(
      Number(itisResponse.tsn),
      itisResponse.scientificName,
      commonName,
      itisResponse,
      itisResponse.updateDate
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
