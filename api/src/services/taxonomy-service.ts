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
  tsn: string;
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
    const taxon = await this.taxonRepository.getTaxonByTsnIds(tsnIds);

    if (taxon.length > 0) {
      return this._sanitizeItisData(taxon);
    }

    const itisService = new ItisService();
    const itisResponse = await itisService.searchItisByTSN(tsnIds);

    const taxonRecords: ItisTaxonRecord[] = [];
    for (const itisRecord of itisResponse) {
      const taxonRecord = await this.addItisTaxonRecord(itisRecord, itisRecord.tsn);
      taxonRecords.push(taxonRecord);
    }

    return this._sanitizeItisData(taxonRecords);
  }

  _sanitizeItisData(itisData: ItisTaxonRecord[]): IItisSearchResult[] {
    const sanitizedData: IItisSearchResult[] = [];

    for (const itisRecord of itisData) {
      const label = itisRecord.common_name || itisRecord.itis_scientific_name;
      const scientificName = itisRecord.itis_scientific_name;
      const tsn = itisRecord.itis_tsn.toString();

      sanitizedData.push({ tsn, label, scientificName });
    }

    return sanitizedData;
  }

  /**
   * Adds a new taxon record.
   *
   * @param {IItisSearchResponse} itisResponse
   * @param {(string | null)} [bcTaxonCode=null]
   * @return {*}  {Promise<ItisTaxonRecord>}
   * @memberof TaxonomyService
   */
  async addItisTaxonRecord(itisResponse: IItisSearchResponse, bcTaxonCode: string): Promise<ItisTaxonRecord> {
    // TODO include optional param for aliases

    let commonName = '';
    if (itisResponse.commonNames) {
      switch (itisResponse.commonNames.length) {
        case 0:
          commonName = itisResponse.scientificName;
          break;
        case 1:
          commonName = itisResponse.commonNames[0];
          break;
        default:
          commonName = itisResponse.commonNames.join(', ');
          break;
      }
    }

    return this.taxonRepository.addItisTaxonRecord(
      Number(itisResponse.tsn),
      bcTaxonCode,
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
