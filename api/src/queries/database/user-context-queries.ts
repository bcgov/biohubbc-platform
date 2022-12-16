import { SQL, SQLStatement } from 'sql-template-strings';
import { SYSTEM_IDENTITY_SOURCE } from '../../constants/database';

export const setSystemUserContextSQL = (userGuid: string, systemUserType: SYSTEM_IDENTITY_SOURCE): SQLStatement => {
  console.log(userGuid, systemUserType);

  const sqlstatement = SQL`select api_set_context(${userGuid}, ${systemUserType});`;

  console.log('sqlStatement is : ', sqlstatement);
  return sqlstatement;
};
