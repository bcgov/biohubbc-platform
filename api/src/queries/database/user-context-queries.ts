import { SQL, SQLStatement } from 'sql-template-strings';
import { SYSTEM_IDENTITY_SOURCE } from '../../constants/database';

export const setSystemUserContextSQL = (
  userIdentifier: string,
  systemUserType: SYSTEM_IDENTITY_SOURCE
): SQLStatement => {
  return SQL`select api_set_context(${userIdentifier}, ${systemUserType});`;
};
