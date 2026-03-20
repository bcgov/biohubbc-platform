import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { ContributorCodeset, CreateContributorCodeset } from '../models/contributor-codeset';
import { ContributorCodesetRepository } from '../repositories/contributor-codeset-repository';
import { makeSlug } from '../utils/contributor-codeset';
import { DBService } from './db-service';

export class ContributorCodesetService extends DBService {
  contributorCodesetRepository: ContributorCodesetRepository;

  /**
   * Creates an instance of ContributorCodesetService.
   *
   * @param {IDBConnection} connection
   * @memberof ContributorCodesetService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.contributorCodesetRepository = new ContributorCodesetRepository(connection);
  }

  /**
   * Create a contributor_codeset row.
   *
   * @param {CreateContributorCodeset} payload
   * @return {Promise<ContributorCodeset>}
   * @memberof ContributorCodesetService
   */
  async createCodeset(payload: CreateContributorCodeset): Promise<ContributorCodeset> {
    const result = await this.createCodesets([payload]);
    return result[0];
  }

  /**
   * Create contributor_codeset rows in bulk.
   *
   * Rules:
   * - slug identity: `code::<contributor_id>::<key>`
   * - same slug + same metadata => reuse existing
   * - same slug + different metadata => conflict
   *
   * @param {CreateContributorCodeset[]} payloads
   * @return {Promise<ContributorCodeset[]>}
   * @memberof ContributorCodesetService
   */
  async createCodesets(payloads: CreateContributorCodeset[]): Promise<ContributorCodeset[]> {
    if (!payloads.length) {
      return [];
    }

    const payloadEntries = payloads.map((payload) => ({
      payload,
      slug: makeSlug(payload.contributor_id, payload.key)
    }));
    const payloadBySlug = new Map(payloadEntries.map((entry) => [entry.slug, entry.payload]));
    const requestedSlugs = new Set(payloadEntries.map((entry) => entry.slug));

    // Fetch all active rows for the touched contributor codeset identities.
    const existingRows = await this.contributorCodesetRepository.getContributorCodesetsByIdentities(
      payloads.map((payload) => ({
        contributor_id: payload.contributor_id,
        key: payload.key
      }))
    );
    const existingEntries = existingRows.map((existingRow) => ({
      existingRow,
      slug: makeSlug(existingRow.contributor_id, existingRow.key)
    }));

    // Enforce immutable definitions for slugs that already exist in the database.
    this.assertNoDatabaseConflicts(existingEntries, payloadBySlug);
    const existingSlugs = new Set(existingEntries.map((entry) => entry.slug));

    // Keep only payloads that are not already persisted.
    const payloadsToInsert = payloadEntries
      .filter((entry) => !existingSlugs.has(entry.slug))
      .map((entry) => entry.payload);

    // Insert only new slugs. Existing rows are reused.
    const insertedRows = payloadsToInsert.length
      ? await this.contributorCodesetRepository.insertContributorCodesets(payloadsToInsert)
      : [];

    // Return only rows relevant to requested slugs.
    const requestedExistingRows = existingEntries
      .filter((entry) => requestedSlugs.has(entry.slug))
      .map((entry) => entry.existingRow);

    const insertedRowsBySlug = new Map(
      insertedRows.map((insertedRow) => [makeSlug(insertedRow.contributor_id, insertedRow.key), insertedRow])
    );
    const deduplicatedInsertedRows = payloadEntries
      .map((entry) => insertedRowsBySlug.get(entry.slug))
      .filter((row): row is ContributorCodeset => !!row);

    return [...requestedExistingRows, ...deduplicatedInsertedRows];
  }

  /**
   * Get a contributor_codeset row by id.
   *
   * @param {number} codeCategoryId
   * @return {Promise<ContributorCodeset>}
   * @memberof ContributorCodesetService
   */
  getContributorCodesetById(codeCategoryId: number): Promise<ContributorCodeset> {
    return this.contributorCodesetRepository.getContributorCodesetById(codeCategoryId);
  }

  /**
   * Get contributor_codeset rows by contributor id.
   *
   * @param {number} contributorId
   * @return {Promise<ContributorCodeset[]>}
   * @memberof ContributorCodesetService
   */
  getContributorCodesetsByContributorId(contributorId: number): Promise<ContributorCodeset[]> {
    return this.contributorCodesetRepository.getContributorCodesetsByContributorId(contributorId);
  }

  /**
   * Get contributor_codeset rows by contributor id and codeset keys.
   *
   * @param {number} contributorId
   * @param {string[]} codesetKeys
   * @return {Promise<ContributorCodeset[]>}
   * @memberof ContributorCodesetService
   */
  getContributorCodesetsByContributorIdAndKeys(
    contributorId: number,
    codesetKeys: string[]
  ): Promise<ContributorCodeset[]> {
    return this.contributorCodesetRepository.getContributorCodesetsByContributorIdAndKeys(contributorId, codesetKeys);
  }

  /**
   * Validate that existing database rows match expected incoming definitions.
   *
   * If an existing row for a slug has different metadata, this throws a
   * conflict to preserve the immutable definition rule.
   */
  private assertNoDatabaseConflicts(
    existingEntries: Array<{ existingRow: ContributorCodeset; slug: string }>,
    payloadBySlug: Map<string, CreateContributorCodeset>
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
        throw new ApiConflictError('Contributor codeset definition conflict', [
          'ContributorCodesetService->createCodesets',
          `The contributor codeset (${existing.contributor_id}, ${existing.key}) already exists with different metadata. If metadata changed, provide a new unique key.`
        ]);
      }
    }
  }
}
