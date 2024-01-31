import { IDBConnection } from '../database/db';
import { ItisTaxonRecord, TaxonomyRepository } from '../repositories/taxonomy-repository';
import { ESService } from './es-service';

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
  id: string;
  label: string;
  scientificName: string;
}

/**
 * Service for retrieving and processing taxonomic data from Elasticsearch.
 *
 * @export
 * @class TaxonomyService
 * @extends {ESService}
 */
export class TaxonomyService extends ESService {
  taxonRepository: TaxonomyRepository;

  constructor(connection: IDBConnection) {
    super();
    this.taxonRepository = new TaxonomyRepository(connection);
  }

  /**
   * Get taxon records by TSN ids.
   *
   * @param {number[]} tsnIds
   * @return {*}  {Promise<ItisTaxonRecord[]>}
   * @memberof TaxonomyService
   */
  async getTaxonByTsnIds(tsnIds: number[]): Promise<ItisTaxonRecord[]> {
    return this.taxonRepository.getTaxonByTsnIds(tsnIds);

    // TODO if not found for one or more tsnIds, fetch from itis, add to db, and return overall results
  }

  /**
   * Adds a new taxon record.
   *
   * @param {IItisSearchResponse} itisResponse
   * @param {(string | null)} [bcTaxonCode=null]
   * @return {*}  {Promise<ItisTaxonRecord>}
   * @memberof TaxonomyService
   */
  async addItisTaxonRecord(
    itisResponse: IItisSearchResponse,
    bcTaxonCode: string | null = null
  ): Promise<ItisTaxonRecord> {
    // TODO include optional param for aliases

    return this.taxonRepository.addItisTaxonRecord(
      Number(itisResponse.tsn),
      bcTaxonCode,
      itisResponse.scientificName,
      itisResponse.commonNames.join(', '),
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
