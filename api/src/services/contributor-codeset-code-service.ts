import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { ContributorCodesetCode, CreateContributorCodesetCode } from '../models/contributor-codeset-code';
import { ContributorCodesetCodeRepository } from '../repositories/contributor-codeset-code-repository';
import { hasSameContributorCodeDefinition, makeSlug } from '../utils/contributor-codeset';
import { ContributorCodesetCodeIdentity } from './contributor-codeset-code-service.interface';
import { DBService } from './db-service';

export class ContributorCodesetCodeService extends DBService {
  contributorCodesetCodeRepository: ContributorCodesetCodeRepository;

  /**
   * Creates an instance of ContributorCodesetCodeService.
   *
   * @param {IDBConnection} connection
   * @memberof ContributorCodesetCodeService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.contributorCodesetCodeRepository = new ContributorCodesetCodeRepository(connection);
  }

  /**
   * Create a contributor_codeset_code row.
   *
   * @param {CreateContributorCodesetCode} payload
   * @return {Promise<ContributorCodesetCode>}
   * @memberof ContributorCodesetCodeService
   */
  async createContributorCodesetCode(payload: CreateContributorCodesetCode): Promise<ContributorCodesetCode> {
    const result = await this.createContributorCodesetCodes([payload]);
    return result[0];
  }

  /**
   * Create contributor_codeset_code rows in bulk.
   *
   * Rules:
   * - slug identity: `code::<contributor_codeset_id>::<key>`
   * - same slug + same metadata => reuse existing
   * - same slug + different metadata => conflict
   *
   * @param {CreateContributorCodesetCode[]} payloads
   * @return {Promise<ContributorCodesetCode[]>}
   * @memberof ContributorCodesetCodeService
   */
  async createContributorCodesetCodes(payloads: CreateContributorCodesetCode[]): Promise<ContributorCodesetCode[]> {
    if (!payloads.length) {
      return [];
    }

    const payloadEntries = payloads.map((payload) => ({
      payload,
      slug: makeSlug(payload.contributor_codeset_id, payload.key)
    }));
    const payloadBySlug = new Map(payloadEntries.map((entry) => [entry.slug, entry.payload]));
    const requestedSlugs = new Set(payloadEntries.map((entry) => entry.slug));

    // Fetch all active rows for the touched contributor codesets.
    // This gives us the current persisted identities for comparison.
    const contributorCodesetIds = [...new Set(payloads.map((payload) => payload.contributor_codeset_id))];
    const existingRows = await this.contributorCodesetCodeRepository.getContributorCodesetCodesByContributorCodesetIds(
      contributorCodesetIds
    );
    const existingBySlug = new Map(
      existingRows.map((existingRow) => [makeSlug(existingRow.contributor_codeset_id, existingRow.key), existingRow])
    );

    // Enforce immutable definitions for slugs that already exist in the database.
    this.assertNoMetadataConflicts(existingBySlug, payloadBySlug);

    // Keep only payloads that are not already persisted.
    // Filtering prevents redundant inserts and leaves duplicate-key enforcement to the database.
    const payloadsToInsert = payloadEntries
      .filter((entry) => !existingBySlug.has(entry.slug))
      .map((entry) => entry.payload);

    // Insert only new slugs. Existing rows are reused.
    const insertedRows = payloadsToInsert.length
      ? await this.contributorCodesetCodeRepository.insertContributorCodesetCodes(payloadsToInsert)
      : [];

    const insertedBySlug = new Map(
      insertedRows.map((insertedRow) => [makeSlug(insertedRow.contributor_codeset_id, insertedRow.key), insertedRow])
    );
    const result: ContributorCodesetCode[] = [];

    for (const slug of requestedSlugs) {
      const row = existingBySlug.get(slug) ?? insertedBySlug.get(slug);

      if (row) {
        result.push(row);
      }
    }

    return result;
  }

  /**
   * Get a contributor_codeset_code row by id.
   *
   * @param {number} contributorCodesetCodeId
   * @return {Promise<ContributorCodesetCode>}
   * @memberof ContributorCodesetCodeService
   */
  getContributorCodesetCodeById(contributorCodesetCodeId: number): Promise<ContributorCodesetCode> {
    return this.contributorCodesetCodeRepository.getContributorCodesetCodeById(contributorCodesetCodeId);
  }

  /**
   * Get contributor_codeset_code rows by contributor_codeset_id.
   *
   * @param {number} contributorCodesetId
   * @return {Promise<ContributorCodesetCode[]>}
   * @memberof ContributorCodesetCodeService
   */
  getContributorCodesetCodesByContributorCodesetId(contributorCodesetId: number): Promise<ContributorCodesetCode[]> {
    return this.contributorCodesetCodeRepository.getContributorCodesetCodesByContributorCodesetId(contributorCodesetId);
  }

  /**
   * Get contributor_codeset_code rows by contributor_codeset ids.
   *
   * @param {number[]} contributorCodesetIds
   * @return {Promise<ContributorCodesetCode[]>}
   * @memberof ContributorCodesetCodeService
   */
  getContributorCodesetCodesByContributorCodesetIds(
    contributorCodesetIds: number[]
  ): Promise<ContributorCodesetCode[]> {
    return this.contributorCodesetCodeRepository.getContributorCodesetCodesByContributorCodesetIds(
      contributorCodesetIds
    );
  }

  /**
   * Get contributor_codeset_code rows by ids.
   *
   * @param {number[]} contributorCodesetCodeIds
   * @return {Promise<ContributorCodesetCode[]>}
   * @memberof ContributorCodesetCodeService
   */
  getContributorCodesetCodesByIds(contributorCodesetCodeIds: number[]): Promise<ContributorCodesetCode[]> {
    return this.contributorCodesetCodeRepository.getContributorCodesetCodesByIds(contributorCodesetCodeIds);
  }

  /**
   * Find a contributor_codeset_code row by identity.
   *
   * @param {ContributorCodesetCodeIdentity} identity
   * @return {Promise<ContributorCodesetCode | null>}
   * @memberof ContributorCodesetCodeService
   */
  findContributorCodesetCodeByIdentity(
    identity: ContributorCodesetCodeIdentity
  ): Promise<ContributorCodesetCode | null> {
    return this.contributorCodesetCodeRepository.findContributorCodesetCodeByIdentity(identity);
  }

  /**
   * Validate that existing database rows match expected incoming definitions.
   *
   * If an existing row for a slug has different metadata, this throws a
   * conflict to preserve the immutable definition rule.
   */
  private assertNoMetadataConflicts(
    existingBySlug: Map<string, ContributorCodesetCode>,
    payloadBySlug: Map<string, CreateContributorCodesetCode>
  ): void {
    for (const [slug, existing] of existingBySlug) {
      const expected = payloadBySlug.get(slug);

      if (!expected) {
        continue;
      }

      if (!hasSameContributorCodeDefinition(existing, expected)) {
        throw new ApiConflictError('Contributor codeset code definition conflict', [
          'ContributorCodesetCodeService->createContributorCodesetCodes',
          `The code (${existing.contributor_codeset_id}, ${existing.key}) already exists with different metadata. If metadata changed, provide a new unique key.`
        ]);
      }
    }
  }
}
