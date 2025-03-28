import SQL from 'sql-template-strings';
import { SYSTEM_IDENTITY_SOURCE } from '../constants/database';
import { SystemUser } from '../repositories/user-repository';

export type DBConstants = {
  serviceClientUsers: SystemUser[];
};

// Singleton DBConstants instance
let DBConstants: DBConstants | undefined;

/**
 * Initializes the singleton db constants instance used by the api.
 *
 * @return {*}  {Promise<void>}
 */
export const initDBConstants = async function (): Promise<void> {
  if (DBConstants) {
    // Database constants singleton already loaded, do nothing.
    return;
  }

  // Lazy load logger to prevent circular dependencies
  const { getLogger } = await import('../utils/logger');

  const defaultLog = getLogger('database/db');

  try {
    // Lazy load logger to prevent circular dependencies
    const { getAPIUserDBConnection } = await import('./db');

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const response = await connection.sql(selectServiceAccountsSqlStatement, SystemUser);

      DBConstants = { serviceClientUsers: response.rows };

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
  if (!DBConstants) {
    throw Error('DBConstants is not initialized');
  }

  return DBConstants;
};

const selectServiceAccountsSqlStatement = SQL`
  SELECT
    *
  FROM
    "system_user"
  INNER JOIN
    user_identity_source
  ON
    "system_user".user_identity_source_id = user_identity_source.user_identity_source_id
  WHERE
    user_identity_source.name = ${SYSTEM_IDENTITY_SOURCE.SYSTEM};
`;
