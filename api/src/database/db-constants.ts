import SQL from 'sql-template-strings';
import { SYSTEM_IDENTITY_SOURCE } from '../constants/database';
import { SystemUser } from '../models/user';

export type DBConstants = {
  serviceClientUsers: SystemUser[];
};

// Keep constants singleton on globalThis so ESM/CJS loaders share one instance in dev.
type DBConstantsGlobal = typeof globalThis & {
  __biohub_db_constants__?: DBConstants;
};

const dbConstantsGlobal = globalThis as DBConstantsGlobal;

/**
 * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
 */
export const dbConstantsDependencies = {
  getLogger: async () => {
    const { getLogger } = await import('../utils/logger');
    return getLogger;
  },
  getAPIUserDBConnection: async () => {
    const { getAPIUserDBConnection } = await import('./db');
    return getAPIUserDBConnection;
  }
};

/**
 * Initializes the singleton db constants instance used by the api.
 *
 * @return {*}  {Promise<void>}
 */
export const initDBConstants = async function (): Promise<void> {
  if (dbConstantsGlobal.__biohub_db_constants__) {
    // Database constants singleton already loaded, do nothing.
    return;
  }

  // Lazy load logger to prevent circular dependencies
  const getLogger = await dbConstantsDependencies.getLogger();

  const defaultLog = getLogger('database/db');

  try {
    // Lazy load logger to prevent circular dependencies
    const getAPIUserDBConnection = await dbConstantsDependencies.getAPIUserDBConnection();

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const response = await connection.sql(selectServiceAccountsSqlStatement, SystemUser);

      dbConstantsGlobal.__biohub_db_constants__ = { serviceClientUsers: response.rows };

      await connection.commit();
    } catch (error) {
      defaultLog.error({ label: 'initDBConstants', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    defaultLog.error({ label: 'initDBConstants', message: 'failed to create db constants', error });
    throw error;
  }
};

export const getDBConstants = function (): DBConstants {
  const dbConstants = dbConstantsGlobal.__biohub_db_constants__;

  if (!dbConstants) {
    throw Error('DBConstants is not initialized');
  }

  return dbConstants;
};

const selectServiceAccountsSqlStatement = SQL`
  SELECT
    "system_user".system_user_id,
    "system_user".user_identity_source_id,
    "system_user".user_identifier,
    "system_user".user_guid,
    "system_user".record_effective_date,
    "system_user".record_end_date,
    "system_user".create_date,
    "system_user".create_user,
    "system_user".update_date,
    "system_user".update_user,
    "system_user".revision_count,
    "system_user".display_name,
    "system_user".given_name,
    "system_user".family_name,
    "system_user".email,
    "system_user".agency,
    "system_user".notes
  FROM
    "system_user"
  INNER JOIN
    user_identity_source
  ON
    "system_user".user_identity_source_id = user_identity_source.user_identity_source_id
  WHERE
    user_identity_source.name = ${SYSTEM_IDENTITY_SOURCE.SYSTEM};
`;
