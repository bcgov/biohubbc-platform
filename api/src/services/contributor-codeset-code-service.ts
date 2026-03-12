import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { ContributorCodesetCode, CreateContributorCodesetCode } from '../models/contributor-codeset-code';
import { ContributorCodesetCodeRepository } from '../repositories/contributor-codeset-code-repository';
import { makeIdentityKey } from '../utils/contributor-codeset';
import {
  ContributorCodesetCodeDefinition,
  ContributorCodesetCodeIdentity
} from './contributor-codeset-code-service.interface';
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
   * - identity: (contributor_codeset_id, key, version)
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

    const normalizedPayloads = payloads.map((payload) => this.normalizeContributorCodesetCodeDefinition(payload));
    const uniquePayloadsByIdentity = this.assertNoBatchConflicts(normalizedPayloads);
    const uniquePayloads = Array.from(uniquePayloadsByIdentity.values());
    const existingRows = await this.contributorCodesetCodeRepository.getContributorCodesetCodesByIdentities(
      uniquePayloads.map((payload) => this.toIdentity(payload))
    );
    const resolvedByIdentity = this.assertNoDatabaseConflicts(existingRows, uniquePayloadsByIdentity);

    const payloadsToInsert = uniquePayloads.filter(
      (payload) => !resolvedByIdentity.has(this.toContributorCodesetCodeIdentityKey(payload))
    );

    const insertedRows = payloadsToInsert.length
      ? await this.contributorCodesetCodeRepository.insertContributorCodesetCodes(payloadsToInsert)
      : [];
    for (const inserted of insertedRows) {
      resolvedByIdentity.set(this.toContributorCodesetCodeIdentityKey(inserted), inserted);
    }

    return this.resolveRowsByIdentity(normalizedPayloads, resolvedByIdentity);
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
   * Compare two contributor codeset code definitions for semantic equality.
   *
   * This is used to enforce immutability for an identity by verifying that
   * repeated submissions with the same `(contributor_codeset_id, key, version)`
   * do not change `label` or `description`.
   */
  private hasSameContributorCodesetCodeDefinition(
    a: ContributorCodesetCodeDefinition,
    b: ContributorCodesetCodeDefinition
  ): boolean {
    return (
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
  private toIdentity(
    payload: Pick<CreateContributorCodesetCode, 'contributor_codeset_id' | 'key' | 'version'>
  ): ContributorCodesetCodeIdentity {
    return {
      contributor_codeset_id: payload.contributor_codeset_id,
      key: payload.key,
      version: payload.version
    };
  }

  /**
   * Validate and deduplicate incoming payloads by identity.
   *
   * This catches conflicting definitions within the same batch before any
   * database calls, which prevents partial work and yields deterministic errors.
   */
  private assertNoBatchConflicts(payloads: CreateContributorCodesetCode[]): Map<string, CreateContributorCodesetCode> {
    const byIdentity = new Map<string, CreateContributorCodesetCode>();

    for (const payload of payloads) {
      const identityKey = this.toContributorCodesetCodeIdentityKey(payload);
      const existing = byIdentity.get(identityKey);

      if (existing && !this.hasSameContributorCodesetCodeDefinition(existing, payload)) {
        throw new ApiConflictError('Contributor codeset code definition conflict', [
          'ContributorCodesetCodeService->createContributorCodesetCodes',
          `Conflicting definitions in batch for code (${payload.contributor_codeset_id}, ${payload.key}, ${payload.version}). If label or description changed, provide a new unique version.`
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
    existingRows: ContributorCodesetCode[],
    expectedByIdentity: Map<string, CreateContributorCodesetCode>
  ): Map<string, ContributorCodesetCode> {
    const resolved = new Map<string, ContributorCodesetCode>();

    for (const existing of existingRows) {
      const identityKey = this.toContributorCodesetCodeIdentityKey(existing);
      const expected = expectedByIdentity.get(identityKey);

      if (!expected) {
        continue;
      }

      if (!this.hasSameContributorCodesetCodeDefinition(existing, expected)) {
        throw new ApiConflictError('Contributor codeset code definition conflict', [
          'ContributorCodesetCodeService->createContributorCodesetCodes',
          `The code (${existing.contributor_codeset_id}, ${existing.key}, ${existing.version}) already exists with different metadata. If label or description changed, provide a new unique version.`
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
    payloads: CreateContributorCodesetCode[],
    resolvedByIdentity: Map<string, ContributorCodesetCode>
  ): ContributorCodesetCode[] {
    return payloads.map((payload) => {
      const resolved = resolvedByIdentity.get(this.toContributorCodesetCodeIdentityKey(payload));

      if (!resolved) {
        throw new ApiConflictError('Contributor codeset code definition conflict', [
          'ContributorCodesetCodeService->createContributorCodesetCodes',
          `Failed to resolve code (${payload.contributor_codeset_id}, ${payload.key}, ${payload.version})`
        ]);
      }

      return resolved;
    });
  }

  /**
   * Normalize contributor codeset code metadata to canonical lowercase values.
   *
   * Canonical normalization ensures deterministic comparisons and storage for
   * immutable `(contributor_codeset_id, key, version)` definitions.
   */
  private normalizeContributorCodesetCodeDefinition(
    payload: CreateContributorCodesetCode
  ): CreateContributorCodesetCode {
    return {
      ...payload,
      label: payload.label.toLowerCase(),
      description: payload.description?.toLowerCase() ?? null
    };
  }

  /**
   * Build a deterministic identity cache key for contributor codeset codes.
   *
   * Identity-key generation stays in this service so identity semantics remain
   * local while delegating string composition to a shared util.
   */
  private toContributorCodesetCodeIdentityKey(
    payload: Pick<CreateContributorCodesetCode, 'contributor_codeset_id' | 'key' | 'version'>
  ): string {
    return makeIdentityKey(payload.contributor_codeset_id, payload.key, payload.version);
  }
}
