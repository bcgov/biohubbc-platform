import { ApiConflictError, ApiExecuteSQLError } from '../errors/api-error';

/**
 * Translate known contributor uniqueness violations after transaction rollback.
 * DB errors retain their message inside ApiExecuteSQLError but not their pg code.
 * @param error - Original endpoint error.
 * @returns A domain conflict for known constraints, otherwise the original error.
 */
export function translateContributorError(error: unknown): unknown {
  if (error instanceof ApiExecuteSQLError) {
    const conflict = error.errors.some((detail) => {
      const message = typeof detail === 'object' && 'message' in detail ? String(detail.message) : '';
      return /duplicate key value violates unique constraint "(contributor_uk|contributor_system_uk1|contributor_system_uk2)"/.test(
        message
      );
    });
    if (conflict) {
      return new ApiConflictError(
        'An active contributor with this client ID or an active relationship for this user already exists'
      );
    }
  }
  return error;
}
