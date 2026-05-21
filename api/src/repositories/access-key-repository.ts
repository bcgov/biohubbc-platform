import SQL from 'sql-template-strings';
import { AccessKey, AccessKeyView } from '../models/access-key';
import { BaseRepository } from './base-repository';

/**
 * Parameters for inserting a new access_key row.
 */
export interface IInsertAccessKeyParams {
  system_user_id: number;
  name: string;
  key_prefix: string;
  key_hash: string;
  expires_at: string;
}

export class AccessKeyRepository extends BaseRepository {
  /**
   * Insert a new access key record.
   *
   * @param {IInsertAccessKeyParams} params
   * @return {Promise<AccessKeyView>}
   * @memberof AccessKeyRepository
   */
  async insertAccessKey(params: IInsertAccessKeyParams): Promise<AccessKeyView> {
    const sqlStatement = SQL`
      INSERT INTO access_key (
        system_user_id,
        name,
        key_prefix,
        key_hash,
        expires_at
      ) VALUES (
        ${params.system_user_id},
        ${params.name},
        ${params.key_prefix},
        ${params.key_hash},
        ${params.expires_at}
      )
      RETURNING
        access_key_id,
        system_user_id,
        name,
        key_prefix,
        expires_at,
        revoked_at,
        last_used_at,
        record_end_date,
        create_date,
        create_user,
        update_date,
        update_user,
        revision_count;
    `;

    const response = await this.connection.sql(sqlStatement, AccessKeyView);

    return response.rows[0];
  }

  /**
   * Fetch an active access key by its prefix.
   *
   * Returns `null` if no active key matches the prefix.
   * Used during API-key authentication — the full `key_hash` is included so the caller
   * can verify the supplied plaintext key.
   *
   * @param {string} keyPrefix - The `key_prefix` value (e.g. `biohub_AbCdEfGh`).
   * @return {Promise<AccessKey | null>}
   * @memberof AccessKeyRepository
   */
  async getAccessKeyByPrefix(keyPrefix: string): Promise<AccessKey | null> {
    const sqlStatement = SQL`
      SELECT *
      FROM access_key
      WHERE key_prefix = ${keyPrefix}
        AND record_end_date IS NULL
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, AccessKey);

    return response.rows[0] ?? null;
  }

  /**
   * Fetch an active access key by its primary key.
   *
   * Returns `null` if no active key matches.
   *
   * @param {string} accessKeyId - UUID of the access key.
   * @return {Promise<AccessKeyView | null>}
   * @memberof AccessKeyRepository
   */
  async getAccessKeyById(accessKeyId: string): Promise<AccessKeyView | null> {
    const sqlStatement = SQL`
      SELECT
        access_key_id,
        system_user_id,
        name,
        key_prefix,
        expires_at,
        revoked_at,
        last_used_at,
        record_end_date,
        create_date,
        create_user,
        update_date,
        update_user,
        revision_count
      FROM access_key
      WHERE access_key_id = ${accessKeyId}
        AND record_end_date IS NULL
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, AccessKeyView);

    return response.rows[0] ?? null;
  }

  /**
   * List all active access keys belonging to a system user.
   *
   * `key_hash` is intentionally excluded so hashes are never serialised to API responses.
   *
   * @param {number} systemUserId
   * @return {Promise<AccessKeyView[]>}
   * @memberof AccessKeyRepository
   */
  async listAccessKeysByUserId(systemUserId: number): Promise<AccessKeyView[]> {
    const sqlStatement = SQL`
      SELECT
        access_key_id,
        system_user_id,
        name,
        key_prefix,
        expires_at,
        revoked_at,
        last_used_at,
        record_end_date,
        create_date,
        create_user,
        update_date,
        update_user,
        revision_count
      FROM access_key
      WHERE system_user_id = ${systemUserId}
        AND record_end_date IS NULL
      ORDER BY create_date DESC;
    `;

    const response = await this.connection.sql(sqlStatement, AccessKeyView);

    return response.rows;
  }

  /**
   * Revoke an access key by setting `revoked_at` to the current timestamp.
   *
   * The operation is idempotent — revoking an already-revoked key is a no-op.
   * Owner-scoping via `system_user_id` prevents IDOR attacks.
   *
   * @param {string} accessKeyId - UUID of the key to revoke.
   * @param {number} systemUserId - Owner check; the key must belong to this user.
   * @return {Promise<void>}
   * @memberof AccessKeyRepository
   */
  async revokeAccessKey(accessKeyId: string, systemUserId: number): Promise<void> {
    const sqlStatement = SQL`
      UPDATE access_key
      SET revoked_at = now(),
          expires_at = now()
      WHERE access_key_id = ${accessKeyId}
        AND system_user_id = ${systemUserId}
        AND record_end_date IS NULL
        AND revoked_at IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Soft-delete an access key owned by a system user.
   *
   * Sets `record_end_date` and `expires_at` to now so the row is excluded from active queries
   * and immediately invalidated. Also sets `revoked_at` if the key has not already been revoked.
   * Owner-scoping via `system_user_id` prevents IDOR attacks.
   *
   * @param {string} accessKeyId - UUID of the key to delete.
   * @param {number} systemUserId - Owner check; the key must belong to this user.
   * @return {Promise<void>}
   * @memberof AccessKeyRepository
   */
  async deleteAccessKey(accessKeyId: string, systemUserId: number): Promise<void> {
    const sqlStatement = SQL`
      UPDATE access_key
      SET record_end_date = now(),
          expires_at      = now(),
          revoked_at      = COALESCE(revoked_at, now())
      WHERE access_key_id = ${accessKeyId}
        AND system_user_id = ${systemUserId}
        AND record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Update the `last_used_at` timestamp for an access key.
   *
   * Called on every successful API-key authentication to support usage auditing.
   *
   * @param {string} accessKeyId - UUID of the key.
   * @return {Promise<void>}
   * @memberof AccessKeyRepository
   */
  async touchLastUsedAt(accessKeyId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE access_key
      SET last_used_at = now()
      WHERE access_key_id = ${accessKeyId}
        AND record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }
}
