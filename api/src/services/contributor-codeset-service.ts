import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { ContributorCodeset, CreateContributorCodeset } from '../models/contributor-codeset';
import { ContributorCodesetRepository } from '../repositories/contributor-codeset-repository';
import { makeIdentityKey } from '../utils/contributor-codeset';
import { ContributorCodesetDefinition, ContributorCodesetIdentity } from './contributor-codeset-service.interface';
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
   * - identity: (contributor_id, key)
   * - same identity + same metadata => reuse existing
   * - same identity + different metadata => conflict
   *
   * @param {CreateContributorCodeset[]} payloads
   * @return {Promise<ContributorCodeset[]>}
   * @memberof ContributorCodesetService
   */
  async createCodesets(payloads: CreateContributorCodeset[]): Promise<ContributorCodeset[]> {
    if (!payloads.length) {
      return [];
    }

    const normalizedPayloads = payloads.map((payload) => this.normalizeContributorCodesetDefinition(payload));
    const uniquePayloadsByIdentity = this.assertNoBatchConflicts(normalizedPayloads);
    const uniquePayloads = Array.from(uniquePayloadsByIdentity.values());
    const existingRows = await this.contributorCodesetRepository.getContributorCodesetsByIdentities(
      uniquePayloads.map((payload) => this.toIdentity(payload))
    );
    const resolvedByIdentity = this.assertNoDatabaseConflicts(existingRows, uniquePayloadsByIdentity);

    const payloadsToInsert = uniquePayloads.filter(
      (payload) => !resolvedByIdentity.has(this.toContributorCodesetIdentityKey(payload))
    );

    const insertedRows = payloadsToInsert.length
      ? await this.contributorCodesetRepository.insertContributorCodesets(payloadsToInsert)
      : [];

    for (const inserted of insertedRows) {
      resolvedByIdentity.set(this.toContributorCodesetIdentityKey(inserted), inserted);
    }

    return this.resolveRowsByIdentity(normalizedPayloads, resolvedByIdentity);
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
   * Compare two contributor codeset definitions for semantic equality.
   *
   * This is used to enforce immutability for an identity by verifying that
   * repeated submissions with the same `(contributor_id, key)` do not
   * change `external_id`, `label` or `description`.
   */
  private hasSameContributorCodesetDefinition(
    a: ContributorCodesetDefinition,
    b: ContributorCodesetDefinition
  ): boolean {
    return (
      a.external_id === b.external_id &&
      a.label.toLowerCase() === b.label.toLowerCase() &&
      (a.description?.toLowerCase() ?? null) === (b.description?.toLowerCase() ?? null)
    );
  }

  /**
   * Convert a payload into its identity tuple object.
   *
   * Keeping this in one place avoids duplicated identity mapping logic and
   * ensures repository lookups always use the same identity fields.
   */
  private toIdentity(payload: Pick<CreateContributorCodeset, 'contributor_id' | 'key'>): ContributorCodesetIdentity {
    return {
      contributor_id: payload.contributor_id,
      key: payload.key
    };
  }

  /**
   * Validate and deduplicate incoming payloads by identity.
   *
   * This catches conflicting definitions within the same batch before any
   * database calls, which prevents partial work and yields deterministic errors.
   */
  private assertNoBatchConflicts(payloads: CreateContributorCodeset[]): Map<string, CreateContributorCodeset> {
    const byIdentity = new Map<string, CreateContributorCodeset>();

    for (const payload of payloads) {
      const identityKey = this.toContributorCodesetIdentityKey(payload);
      const existing = byIdentity.get(identityKey);

      if (existing && !this.hasSameContributorCodesetDefinition(existing, payload)) {
        throw new ApiConflictError('Contributor codeset definition conflict', [
          'ContributorCodesetService->createCodesets',
          `Conflicting definitions in batch for contributor codeset (${payload.contributor_id}, ${payload.key}). If metadata changed, provide a new unique key.`
        ]);
      }

      byIdentity.set(identityKey, payload);
    }

    return byIdentity;
  }

  /**
   * Validate that existing database rows match expected incoming definitions.
   *
   * If an existing row for an identity has different metadata, this throws a
   * conflict to preserve the immutable definition rule.
   */
  private assertNoDatabaseConflicts(
    existingRows: ContributorCodeset[],
    expectedByIdentity: Map<string, CreateContributorCodeset>
  ): Map<string, ContributorCodeset> {
    const resolved = new Map<string, ContributorCodeset>();

    for (const existing of existingRows) {
      const identityKey = this.toContributorCodesetIdentityKey(existing);
      const expected = expectedByIdentity.get(identityKey);

      if (!expected) {
        continue;
      }

      if (!this.hasSameContributorCodesetDefinition(existing, expected)) {
        throw new ApiConflictError('Contributor codeset definition conflict', [
          'ContributorCodesetService->createCodesets',
          `The contributor codeset (${existing.contributor_id}, ${existing.key}) already exists with different metadata. If metadata changed, provide a new unique key.`
        ]);
      }

      resolved.set(identityKey, existing);
    }

    return resolved;
  }

  /**
   * Resolve normalized payloads to persisted rows in original input order.
   *
   * Returning rows in request order keeps upstream processing deterministic while
   * still allowing internal deduplication and bulk operations.
   */
  private resolveRowsByIdentity(
    payloads: CreateContributorCodeset[],
    resolvedByIdentity: Map<string, ContributorCodeset>
  ): ContributorCodeset[] {
    return payloads.map((payload) => {
      const resolved = resolvedByIdentity.get(this.toContributorCodesetIdentityKey(payload));

      if (!resolved) {
        throw new ApiConflictError('Contributor codeset definition conflict', [
          'ContributorCodesetService->createCodesets',
          `Failed to resolve contributor codeset (${payload.contributor_id}, ${payload.key})`
        ]);
      }

      return resolved;
    });
  }

  /**
   * Normalize contributor codeset metadata to canonical lowercase values.
   *
   * Canonical normalization ensures deterministic comparisons and storage for
   * immutable `(contributor_id, key)` definitions.
   */
  private normalizeContributorCodesetDefinition(payload: CreateContributorCodeset): CreateContributorCodeset {
    return {
      ...payload,
      label: payload.label.toLowerCase(),
      description: payload.description?.toLowerCase() ?? null
    };
  }

  /**
   * Build a deterministic identity cache key for contributor codesets.
   *
   * Identity-key generation stays in this service so identity semantics remain
   * local while delegating string composition to a shared util.
   */
  private toContributorCodesetIdentityKey(payload: Pick<CreateContributorCodeset, 'contributor_id' | 'key'>): string {
    return makeIdentityKey(payload.contributor_id, payload.key);
  }
}
