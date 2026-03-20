import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { ContributorCodesetCode, CreateContributorCodesetCode } from '../models/contributor-codeset-code';
import { ContributorCodesetCodeRepository } from '../repositories/contributor-codeset-code-repository';
import { makeSlug } from '../utils/contributor-codeset';
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

    // Fetch all active rows for the touched contributor codesets in one query.
    // This gives us the current persisted identities for comparison.
    const contributorCodesetIds = [...new Set(payloads.map((payload) => payload.contributor_codeset_id))];
    const existingRows = await this.contributorCodesetCodeRepository.getContributorCodesetCodesByContributorCodesetIds(
      contributorCodesetIds
    );
    const existingEntries = existingRows.map((existingRow) => ({
      existingRow,
      slug: makeSlug(existingRow.contributor_codeset_id, existingRow.key)
    }));

    // Enforce immutable definitions for slugs that already exist in the database.
    this.assertNoDatabaseConflicts(existingEntries, payloadBySlug);
    const existingSlugs = new Set(existingEntries.map((entry) => entry.slug));

    // Keep only payloads that are not already persisted.
    // Filtering prevents redundant inserts and leaves duplicate-key enforcement to the database.
    const payloadsToInsert = payloadEntries
      .filter((entry) => !existingSlugs.has(entry.slug))
      .map((entry) => entry.payload);

    // Insert only new slugs. Existing rows are reused.
    const insertedRows = payloadsToInsert.length
      ? await this.contributorCodesetCodeRepository.insertContributorCodesetCodes(payloadsToInsert)
      : [];

    // Return only rows relevant to requested slugs.
    const requestedExistingRows = existingEntries
      .filter((entry) => requestedSlugs.has(entry.slug))
      .map((entry) => entry.existingRow);

    const insertedRowsBySlug = new Map(
      insertedRows.map((insertedRow) => [makeSlug(insertedRow.contributor_codeset_id, insertedRow.key), insertedRow])
    );
    const deduplicatedInsertedRows = payloadEntries
      .map((entry) => insertedRowsBySlug.get(entry.slug))
      .filter((row): row is ContributorCodesetCode => !!row);

    return [...requestedExistingRows, ...deduplicatedInsertedRows];
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
  private assertNoDatabaseConflicts(
    existingEntries: Array<{ existingRow: ContributorCodesetCode; slug: string }>,
    payloadBySlug: Map<string, CreateContributorCodesetCode>
  ): void {
    for (const existingEntry of existingEntries) {
      const expected = payloadBySlug.get(existingEntry.slug);
      const existing = existingEntry.existingRow;

      if (!expected) {
        continue;
      }

      if (
        existing.external_id !== expected.external_id ||
        existing.label !== expected.label ||
        (existing.description ?? null) !== (expected.description ?? null)
      ) {
        throw new ApiConflictError('Contributor codeset code definition conflict', [
          'ContributorCodesetCodeService->createContributorCodesetCodes',
          `The code (${existing.contributor_codeset_id}, ${existing.key}) already exists with different metadata. If metadata changed, provide a new unique key.`
        ]);
      }
    }
  }
}
