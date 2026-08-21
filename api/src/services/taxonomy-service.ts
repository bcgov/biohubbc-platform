import { ITIS_TSN_LOOKUP_BATCH_SIZE, ITIS_TSN_LOOKUP_DELAY_MS } from '../constants/taxonomy';
import { IDBConnection } from '../database/db';
import { AddItisTaxonRecord, FindTaxonFilters, TaxonParentLinkRecord, TaxonRecord } from '../models/taxon';
import { TaxonomyRepository } from '../repositories/taxonomy-repository';
import { getItisTaxonCommonNames } from '../utils/itis-utils';
import { getLogger } from '../utils/logger';
import { taxonNeedsHierarchyRepair, taxonNeedsRankRepair } from '../utils/taxon';
import { getUnique } from '../utils/unique';
import { DBService } from './db-service';
import { ItisService, ItisSolrSearchResponse } from './itis-service';
import { TaxonRepairPlan, TaxonSearchResult } from './taxonomy-service.interface';

const defaultLog = getLogger('services/taxonomy-service');

/**
 * Service for retrieving and processing taxonomic data from BioHub.
 *
 * @export
 * @class TaxonomyService
 * @extends {DBService}
 */
export class TaxonomyService extends DBService {
  taxonRepository: TaxonomyRepository;

  /**
   * Construct a TaxonomyService.
   *
   * @param {IDBConnection} connection Active database connection.
   * @memberof TaxonomyService
   */
  constructor(connection: IDBConnection) {
    super(connection);

    this.taxonRepository = new TaxonomyRepository(connection);
  }

  /**
   * Get taxon records by TSN ids.
   *
   * This method is the read-facing entry point. It returns cached local taxon records when possible,
   * and only falls back to the hierarchy ensure path for TSNs that are not present locally. Existing
   * rows are returned as-is here; ingestion-specific repair of incomplete cached rows happens through
   * `ensureTaxonHierarchyByTsnIds`.
   *
   * @param {number[]} tsnIds
   * @return {*}  {Promise<TaxonSearchResult[]>}
   * @memberof TaxonomyService
   */
  async getTaxonByTsnIds(tsnIds: number[]): Promise<TaxonSearchResult[]> {
    defaultLog.debug({ label: 'getTaxonByTsnIds', tsnIds });

    const uniqueTsnIds = getUnique(tsnIds);

    if (!uniqueTsnIds.length) {
      return [];
    }

    // First check the local taxon cache. The caller can pass duplicates, but the local query and the
    // ITIS ensure path should only work on distinct TSNs.
    const existingTaxonRecords = await this.taxonRepository.findTaxonByTsnIds(uniqueTsnIds);
    const existingTsnIds = new Set(existingTaxonRecords.map((record) => record.itis_tsn));

    // Only TSNs with no local row need to go through ITIS from this read path.
    const missingTsnIds = uniqueTsnIds.filter((tsnId) => !existingTsnIds.has(tsnId));

    if (!missingTsnIds.length) {
      return this._sanitizeTaxonRecordsData(existingTaxonRecords);
    }

    // If the local database does not contain a record for all of the requested ids, ensure the full ITIS
    // hierarchy for the missing taxa exists locally (inserting/reusing every taxon in each lineage and
    // storing parent links), then re-read to include the newly patched records.
    await this.ensureTaxonHierarchyByTsnIds(missingTsnIds);

    const taxonRecords = await this.taxonRepository.findTaxonByTsnIds(uniqueTsnIds);

    return this._sanitizeTaxonRecordsData(taxonRecords);
  }

  /**
   * Find locally cached taxon rows by TSN and/or scientific name.
   *
   * No rows is a valid empty result. Callers that need strict validation should enforce that at
   * their own service boundary.
   *
   * @param {FindTaxonFilters} filters Taxon lookup filters.
   * @return {*}  {Promise<TaxonRecord[]>}
   * @memberof TaxonomyService
   */
  async findTaxon(filters: FindTaxonFilters): Promise<TaxonRecord[]> {
    return this.taxonRepository.findTaxon(filters);
  }

  /**
   * Ensure the full ITIS hierarchy for the given taxon TSNs exists locally.
   *
   * For any TSN not already cached, this fetches the ordered ITIS `hierarchyTSN` lineage, inserts or
   * reuses every taxon in that lineage, stores each taxon's `parent_itis_tsn` (derived from the previous
   * TSN in the ordered lineage), and resolves `parent_taxon_id` by linking each child to its immediate
   * parent row.
   *
   * The method also repairs cached rows that predate the first-class hierarchy/rank columns:
   * - hierarchy repair fetches ITIS lineage data and writes parent links;
   * - rank repair fetches ITIS taxon records and patches rank.
   *
   * All external calls and bulk writes are chunked sequentially. That keeps ITIS URL lengths bounded,
   * avoids bursts of concurrent outbound requests, and keeps each JSONB bulk operation at a predictable
   * size.
   *
   * @param {number[]} tsnIds
   * @return {*}  {Promise<void>}
   * @memberof TaxonomyService
   */
  async ensureTaxonHierarchyByTsnIds(tsnIds: number[]): Promise<void> {
    defaultLog.debug({ label: 'ensureTaxonHierarchyByTsnIds', tsnIds });

    const uniqueTsnIds = getUnique(tsnIds);

    if (!uniqueTsnIds.length) {
      return;
    }

    const existingRecords = await this.taxonRepository.findTaxonByTsnIds(uniqueTsnIds);
    const { hierarchyTsnIds, incompleteRankTsnIds } = this.buildTaxonRepairPlan(uniqueTsnIds, existingRecords);

    if (!hierarchyTsnIds.length && !incompleteRankTsnIds.length) {
      return;
    }

    // Construct ITIS lazily so callers that are already fully cached do not need any external-service
    // dependencies configured.
    const itisService = new ItisService();

    if (!hierarchyTsnIds.length) {
      // The local rows already have hierarchy links, so avoid the more expensive hierarchy endpoint.
      // A TSN detail lookup is enough to backfill rank for cached rows created before `taxon.rank`.
      await this.patchItisTaxonRanksByTsnIds(itisService, incompleteRankTsnIds);
      return;
    }

    const parentByTsn = await this.fetchParentByTsn(itisService, hierarchyTsnIds);
    // The union of all returned lineage TSNs is the set we need locally before parent links can be
    // resolved. This includes requested taxa and any missing ancestors that ITIS returned with them.
    const lineageTsnIds = Array.from(parentByTsn.keys());

    if (!lineageTsnIds.length) {
      // ITIS can return no hierarchy docs for an otherwise cached TSN. In that case there is no safe
      // parent graph to write, but we can still repair rank if the caller identified stale rank rows.
      await this.patchItisTaxonRanksByTsnIds(itisService, incompleteRankTsnIds);
      return;
    }

    await this.insertMissingLineageTaxaAndPatchRanks(itisService, lineageTsnIds, incompleteRankTsnIds);

    // Store parent_itis_tsn for every taxon that has a parent (roots stay null), then resolve
    // parent_taxon_id by linking each child to its immediate parent row.
    await this.taxonRepository.updateTaxonParentLinks(this.buildParentPairs(parentByTsn));
  }

  /**
   * Build the hierarchy and rank repair plan for requested TSNs.
   *
   * Classifies the requested TSNs into three groups:
   * 1. missing rows, which need full hierarchy and detail lookup;
   * 2. cached rows with incomplete hierarchy fields, which need hierarchy lookup but not insert;
   * 3. cached rows with missing rank, which need an ITIS taxon lookup for rank patching.
   *
   * A row can appear in both repair groups. The returned sets are de-duplicated before calling ITIS so
   * that overlap does not create duplicate network requests.
   *
   * @param {number[]} requestedTsnIds Distinct caller-requested TSNs.
   * @param {TaxonRecord[]} existingRecords Active local taxon rows for the requested TSNs.
   * @return {*}  {TaxonRepairPlan}
   * @memberof TaxonomyService
   */
  private buildTaxonRepairPlan(requestedTsnIds: number[], existingRecords: TaxonRecord[]): TaxonRepairPlan {
    const existingTsnIds = new Set<number>();
    const incompleteHierarchyTsnIds: number[] = [];
    const incompleteRankTsnIds: number[] = [];

    for (const record of existingRecords) {
      existingTsnIds.add(record.itis_tsn);

      if (taxonNeedsHierarchyRepair(record)) {
        incompleteHierarchyTsnIds.push(record.itis_tsn);
      }

      if (taxonNeedsRankRepair(record)) {
        incompleteRankTsnIds.push(record.itis_tsn);
      }
    }

    const missingTsnIds = requestedTsnIds.filter((tsnId) => !existingTsnIds.has(tsnId));

    return {
      hierarchyTsnIds: getUnique([...missingTsnIds, ...incompleteHierarchyTsnIds]),
      incompleteRankTsnIds: getUnique(incompleteRankTsnIds)
    };
  }

  /**
   * Fetch ITIS hierarchy documents and derive immediate parent TSNs for every returned lineage item.
   *
   * @param {ItisService} itisService ITIS client.
   * @param {number[]} hierarchyTsnIds TSNs that need hierarchy lookup.
   * @return {*}  {Promise<Map<number, number | null>>}
   * @memberof TaxonomyService
   */
  private async fetchParentByTsn(
    itisService: ItisService,
    hierarchyTsnIds: number[]
  ): Promise<Map<number, number | null>> {
    // Fetch the full ordered ITIS `hierarchyTSN` lineage for each taxon needing hierarchy repair.
    // Keep requests bounded because the ITIS Solr API is URL-based and caps response rows.
    const hierarchies = await DBService.mapChunksSequential(
      hierarchyTsnIds,
      ITIS_TSN_LOOKUP_BATCH_SIZE,
      (chunk) => itisService.getHierarchyForTSNs(chunk),
      ITIS_TSN_LOOKUP_DELAY_MS
    );
    const parentByTsn = new Map<number, number | null>();

    for (const { hierarchy } of hierarchies) {
      // ITIS returns a lineage ordered from root to requested taxon, for example:
      // [kingdom, phylum, class, order, family, genus, species].
      // The immediate parent for each item is therefore the previous item in the same array. The first
      // item is the lineage root and intentionally has no parent.
      hierarchy.forEach((tsn, index) => {
        parentByTsn.set(tsn, index === 0 ? null : hierarchy[index - 1]);
      });
    }

    return parentByTsn;
  }

  /**
   * Insert missing lineage taxa and patch stale ranks using one combined ITIS detail lookup.
   *
   * @param {ItisService} itisService ITIS client.
   * @param {number[]} lineageTsnIds TSNs returned by ITIS hierarchy lookup.
   * @param {number[]} incompleteRankTsnIds Requested cached TSNs with missing rank.
   * @return {*}  {Promise<void>}
   * @memberof TaxonomyService
   */
  private async insertMissingLineageTaxaAndPatchRanks(
    itisService: ItisService,
    lineageTsnIds: number[],
    incompleteRankTsnIds: number[]
  ): Promise<void> {
    // Insert or reuse every taxon in the combined lineage, and patch rank for cached rows that predate
    // the first-class rank column. Fetch ITIS details once for the combined missing/patch set.
    const existingLineageRecords = await this.taxonRepository.findTaxonByTsnIds(lineageTsnIds);
    const existingLineageTsnIds = new Set<number>();
    const incompleteLineageRankTsnIds: number[] = [];

    for (const record of existingLineageRecords) {
      existingLineageTsnIds.add(record.itis_tsn);

      if (taxonNeedsRankRepair(record)) {
        incompleteLineageRankTsnIds.push(record.itis_tsn);
      }
    }

    const missingLineageTsnIds = lineageTsnIds.filter((tsnId) => !existingLineageTsnIds.has(tsnId));
    // Rank patching must include stale rows originally requested by the caller and stale ancestors
    // discovered from the returned lineages. Missing lineage rows also need detail payloads so they can
    // be inserted. Combining these sets lets the service call `searchItisByTSN` once.
    const rankPatchTsnIds = getUnique([...incompleteRankTsnIds, ...incompleteLineageRankTsnIds]);
    const taxonLookupTsnIds = getUnique([...missingLineageTsnIds, ...rankPatchTsnIds]);

    if (taxonLookupTsnIds.length) {
      const itisResponse = await DBService.mapChunksSequential(
        taxonLookupTsnIds,
        ITIS_TSN_LOOKUP_BATCH_SIZE,
        (chunk) => itisService.searchItisByTSN(chunk),
        ITIS_TSN_LOOKUP_DELAY_MS
      );
      const missingLineageTsnIdSet = new Set(missingLineageTsnIds);
      const rankPatchTsnIdSet = new Set(rankPatchTsnIds);

      // Insert only the detail responses for lineage TSNs that do not already have local rows.
      // Existing rows are handled by the rank patch below so this path does not overwrite cached taxon
      // metadata beyond fields the repository explicitly patches.
      await this.addItisTaxonRecords(
        itisResponse.filter((response) => missingLineageTsnIdSet.has(Number(response.tsn)))
      );

      // Patch cached rows that were known to be missing rank. Responses for newly inserted rows are
      // excluded because their rank is already written during insert.
      await this.patchItisTaxonRanks(itisResponse.filter((response) => rankPatchTsnIdSet.has(Number(response.tsn))));
    }
  }

  /**
   * Build parent-link records for non-root lineage taxa.
   *
   * Lineage roots have no parent by definition. For now, kingdom rows are the only rank treated as
   * complete with null parent fields by `taxonNeedsHierarchyRepair`; other ranks remain eligible for
   * repair until the cache has an explicit hierarchy-complete marker.
   *
   * @param {Map<number, number | null>} parentByTsn Parent TSN keyed by child TSN.
   * @return {*}  {TaxonParentLinkRecord[]}
   * @memberof TaxonomyService
   */
  private buildParentPairs(parentByTsn: Map<number, number | null>): TaxonParentLinkRecord[] {
    const parentPairs: TaxonParentLinkRecord[] = [];

    for (const [itisTsn, parentItisTsn] of parentByTsn.entries()) {
      if (parentItisTsn != null) {
        parentPairs.push({ itis_tsn: itisTsn, parent_itis_tsn: parentItisTsn });
      }
    }

    return parentPairs;
  }

  /**
   * Convert database taxon records into API taxon search results.
   *
   * @param {TaxonRecord[]} taxonRecords Taxon rows returned from the repository.
   * @return {*}  {TaxonSearchResult[]}
   * @memberof TaxonomyService
   */
  private _sanitizeTaxonRecordsData(taxonRecords: TaxonRecord[]): TaxonSearchResult[] {
    return taxonRecords.map((item: TaxonRecord) => ({
      tsn: item.itis_tsn,
      // TODO: wrap commonNames in array until the database supports multiple common names
      commonNames: item?.common_name ? [item.common_name] : [],
      scientificName: item.itis_scientific_name
    }));
  }

  /**
   * Adds new taxon records in bulk.
   *
   * ITIS can return duplicate records for the same TSN when multiple requested lineages overlap. This
   * method de-duplicates by TSN before writing, then inserts in bounded batches. Existing rows are
   * reused by the repository insert query.
   *
   * @param {ItisSolrSearchResponse[]} itisSolrResponses
   * @return {*}  {Promise<TaxonRecord[]>}
   * @memberof TaxonomyService
   */
  async addItisTaxonRecords(itisSolrResponses: ItisSolrSearchResponse[]): Promise<TaxonRecord[]> {
    const recordsByTsn = this.buildItisTaxonRecordsByTsn(itisSolrResponses);

    return DBService.mapChunksSequential(Array.from(recordsByTsn.values()), ITIS_TSN_LOOKUP_BATCH_SIZE, (chunk) =>
      this.taxonRepository.insertTaxonRecords(chunk)
    );
  }

  /**
   * Fetch ITIS details for cached rows that only need rank repair, then patch their rank.
   *
   * @param {ItisService} itisService ITIS client.
   * @param {number[]} tsnIds TSNs whose cached rows are missing rank.
   * @return {*}  {Promise<void>}
   * @memberof TaxonomyService
   */
  private async patchItisTaxonRanksByTsnIds(itisService: ItisService, tsnIds: number[]): Promise<void> {
    if (!tsnIds.length) {
      return;
    }

    const itisResponse = await DBService.mapChunksSequential(
      tsnIds,
      ITIS_TSN_LOOKUP_BATCH_SIZE,
      (chunk) => itisService.searchItisByTSN(chunk),
      ITIS_TSN_LOOKUP_DELAY_MS
    );

    await this.patchItisTaxonRanks(itisResponse);
  }

  /**
   * Patch existing taxon ranks from ITIS responses.
   *
   * This only patches the first-class `rank` column for cached rows. It does not upsert missing
   * taxa, refresh the raw ITIS payload, or update names/common names.
   *
   * @param {ItisSolrSearchResponse[]} itisSolrResponses
   * @return {*}  {Promise<void>}
   * @memberof TaxonomyService
   */
  private async patchItisTaxonRanks(itisSolrResponses: ItisSolrSearchResponse[]): Promise<void> {
    const rankPatchRecordsByTsn = new Map<number, { itis_tsn: number; rank: string | null }>();

    for (const response of itisSolrResponses) {
      const itisTsn = Number(response.tsn);

      rankPatchRecordsByTsn.set(itisTsn, {
        itis_tsn: itisTsn,
        rank: response.rank
      });
    }

    await DBService.mapChunksSequential(
      Array.from(rankPatchRecordsByTsn.values()),
      ITIS_TSN_LOOKUP_BATCH_SIZE,
      async (chunk) => {
        await this.taxonRepository.patchTaxonRanks(chunk);

        return [];
      }
    );
  }

  /**
   * Build de-duplicated taxon record payloads from ITIS responses.
   *
   * The returned map is keyed by numeric TSN. When duplicate ITIS responses are present, the last response
   * for that TSN wins. Common names are currently collapsed to the first normalized value because the taxon
   * table stores a single `common_name`.
   *
   * @param {ItisSolrSearchResponse[]} itisSolrResponses
   * @return {*}  {Map<number, AddItisTaxonRecord>}
   * @memberof TaxonomyService
   */
  private buildItisTaxonRecordsByTsn(itisSolrResponses: ItisSolrSearchResponse[]): Map<number, AddItisTaxonRecord> {
    const recordsByTsn = new Map<number, AddItisTaxonRecord>();

    for (const itisSolrResponse of itisSolrResponses) {
      const itisTsn = Number(itisSolrResponse.tsn);
      const commonNames = getItisTaxonCommonNames(itisSolrResponse?.commonNames);

      recordsByTsn.set(itisTsn, {
        itis_tsn: itisTsn,
        itis_scientific_name: itisSolrResponse.scientificName,
        rank: itisSolrResponse.rank,
        common_name: commonNames[0] ?? null,
        itis_data: itisSolrResponse,
        itis_update_date: itisSolrResponse.updateDate
      });
    }

    return recordsByTsn;
  }
}
