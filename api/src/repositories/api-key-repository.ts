import SQL from 'sql-template-strings';
import { ApiKey, ApiKeyView } from '../models/api-key';
import { BaseRepository } from './base-repository';

/**
 * Parameters for inserting a new api_key row.
 */
export interface IInsertApiKeyParams {
  system_user_id: number;
  name: string;
  key_prefix: string;
  key_hash: string;
  expires_at: string;
}

export class ApiKeyRepository extends BaseRepository {
  /**
   * Insert a new API key record.
   *
   * @param {IInsertApiKeyParams} params
   * @return {Promise<ApiKeyView>}
   * @memberof ApiKeyRepository
   */
  async insertApiKey(params: IInsertApiKeyParams): Promise<ApiKeyView> {
    const sqlStatement = SQL`
      INSERT INTO api_key (
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
        api_key_id,
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

    const response = await this.connection.sql(sqlStatement, ApiKeyView);

    return response.rows[0];
  }

  /**
   * Fetch an active API key by its prefix.
   *
   * Returns `null` if no active key matches the prefix.
   * Used during API-key authentication — the full `key_hash` is included so the caller
   * can verify the supplied plaintext key.
   *
   * @param {string} keyPrefix - The `key_prefix` value (e.g. `biohub_AbCdEfGh`).
   * @return {Promise<ApiKey | null>}
   * @memberof ApiKeyRepository
   */
  async getApiKeyByPrefix(keyPrefix: string): Promise<ApiKey | null> {
    const sqlStatement = SQL`
      SELECT *
      FROM api_key
      WHERE key_prefix = ${keyPrefix}
        AND record_end_date IS NULL
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, ApiKey);

    return response.rows[0] ?? null;
  }

  /**
   * Fetch an active API key by its primary key.
   *
   * Returns `null` if no active key matches.
   *
   * @param {string} apiKeyId - UUID of the API key.
   * @return {Promise<ApiKeyView | null>}
   * @memberof ApiKeyRepository
   */
  async getApiKeyById(apiKeyId: string): Promise<ApiKeyView | null> {
    const sqlStatement = SQL`
      SELECT
        api_key_id,
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
      FROM api_key
      WHERE api_key_id = ${apiKeyId}
        AND record_end_date IS NULL
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, ApiKeyView);

    return response.rows[0] ?? null;
  }

  /**
   * List all active API keys belonging to a system user.
   *
   * `key_hash` is intentionally excluded from this result set.
   *
   * @param {number} systemUserId
   * @return {Promise<ApiKeyView[]>}
   * @memberof ApiKeyRepository
   */
  async listApiKeysByUserId(systemUserId: number): Promise<ApiKeyView[]> {
    const sqlStatement = SQL`
      SELECT
        api_key_id,
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
      FROM api_key
      WHERE system_user_id = ${systemUserId}
        AND record_end_date IS NULL
      ORDER BY create_date DESC;
    `;

    const response = await this.connection.sql(sqlStatement, ApiKeyView);

    return response.rows;
  }

  /**
   * Revoke an API key by setting `revoked_at` and `expires_at` to the current timestamp.
   *
   * The operation is idempotent — revoking an already-revoked key is a no-op.
   * Owner-scoping via `system_user_id` prevents IDOR attacks.
   *
   * @param {string} apiKeyId - UUID of the key to revoke.
   * @param {number} systemUserId - Owner check; the key must belong to this user.
   * @return {Promise<void>}
   * @memberof ApiKeyRepository
   */
  async revokeApiKey(apiKeyId: string, systemUserId: number): Promise<void> {
    const sqlStatement = SQL`
      UPDATE api_key
      SET revoked_at = now(),
          expires_at = now()
      WHERE api_key_id = ${apiKeyId}
        AND system_user_id = ${systemUserId}
        AND record_end_date IS NULL
        AND revoked_at IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Soft-delete an API key owned by a system user.
   *
   * Sets `record_end_date` and `expires_at` to now so the row is excluded from active queries
   * and immediately invalidated. Also sets `revoked_at` if the key has not already been revoked.
   * Owner-scoping via `system_user_id` prevents IDOR attacks.
   *
   * @param {string} apiKeyId - UUID of the key to delete.
   * @param {number} systemUserId - Owner check; the key must belong to this user.
   * @return {Promise<void>}
   * @memberof ApiKeyRepository
   */
  async deleteApiKey(apiKeyId: string, systemUserId: number): Promise<void> {
    const sqlStatement = SQL`
      UPDATE api_key
      SET record_end_date = now(),
          expires_at      = now(),
          revoked_at      = COALESCE(revoked_at, now())
      WHERE api_key_id = ${apiKeyId}
        AND system_user_id = ${systemUserId}
        AND record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Update the `last_used_at` timestamp for an API key.
   *
   * Called on every successful API-key authentication to support usage auditing.
   *
   * @param {string} apiKeyId - UUID of the key.
   * @return {Promise<void>}
   * @memberof ApiKeyRepository
   */
  async touchLastUsedAt(apiKeyId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE api_key
      SET last_used_at = now()
      WHERE api_key_id = ${apiKeyId}
        AND record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }
}
