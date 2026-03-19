import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { ContributorCodesetCode, CreateContributorCodesetCode } from '../models/contributor-codeset-code';
import { ContributorCodesetCodeRepository } from '../repositories/contributor-codeset-code-repository';
import { makeIdentityKey } from '../utils/contributor-codeset';
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
   * - identity: (contributor_codeset_id, key)
   * - same identity + same metadata => reuse existing
   * - same identity + different metadata => conflict
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
      identityKey: makeIdentityKey(payload.contributor_codeset_id, payload.key)
    }));
    const payloadByIdentity = new Map(payloadEntries.map((entry) => [entry.identityKey, entry.payload]));
    const requestedIdentityKeys = new Set(payloadEntries.map((entry) => entry.identityKey));

    // Fetch all active rows for the touched contributor codesets in one query.
    // This gives us the current persisted identities for comparison.
    const contributorCodesetIds = [...new Set(payloads.map((payload) => payload.contributor_codeset_id))];
    const existingRows = await this.contributorCodesetCodeRepository.getContributorCodesetCodesByContributorCodesetIds(
      contributorCodesetIds
    );
    const existingEntries = existingRows.map((existingRow) => ({
      existingRow,
      identityKey: makeIdentityKey(existingRow.contributor_codeset_id, existingRow.key)
    }));

    // Enforce immutable definitions for identities that already exist in the database.
    this.assertNoDatabaseConflicts(existingEntries, payloadByIdentity);
    const existingIdentityKeys = new Set(existingEntries.map((entry) => entry.identityKey));

    // Keep only payloads that are not already persisted.
    // Filtering prevents redundant inserts and leaves duplicate-key enforcement to the database.
    const payloadsToInsert = payloadEntries
      .filter((entry) => !existingIdentityKeys.has(entry.identityKey))
      .map((entry) => entry.payload);

    // Insert only new identities. Existing rows are reused.
    const insertedRows = payloadsToInsert.length
      ? await this.contributorCodesetCodeRepository.insertContributorCodesetCodes(payloadsToInsert)
      : [];

    // Return only rows relevant to requested identities.
    const requestedExistingRows = existingEntries
      .filter((entry) => requestedIdentityKeys.has(entry.identityKey))
      .map((entry) => entry.existingRow);

    const insertedRowsByIdentity = new Map(
      insertedRows.map((insertedRow) => [
        makeIdentityKey(insertedRow.contributor_codeset_id, insertedRow.key),
        insertedRow
      ])
    );
    const deduplicatedInsertedRows = payloadEntries
      .map((entry) => insertedRowsByIdentity.get(entry.identityKey))
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
   * If an existing row for an identity has different metadata, this throws a
   * conflict to preserve the immutable definition rule.
   */
  private assertNoDatabaseConflicts(
    existingEntries: Array<{ existingRow: ContributorCodesetCode; identityKey: string }>,
    payloadByIdentity: Map<string, CreateContributorCodesetCode>
  ): void {
    for (const existingEntry of existingEntries) {
      const expected = payloadByIdentity.get(existingEntry.identityKey);
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
