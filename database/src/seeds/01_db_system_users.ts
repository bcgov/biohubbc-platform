import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;
const DB_ADMIN = process.env.DB_ADMIN;

enum SYSTEM_IDENTITY_SOURCE {
  IDIR = 'IDIR',
  BCEID_BASIC = 'BCEIDBASIC',
  BCEID_BUSINESS = 'BCEIDBUSINESS',
  SYSTEM = 'SYSTEM',
  DATABASE = 'DATABASE'
}

enum SYSTEM_USER_ROLE_NAME {
  SYSTEM_ADMINISTRATOR = 'System Administrator',
  DATA_ADMINISTRATOR = 'Data Administrator'
}

interface SystemUserSeed {
  identifier: string;
  type: SYSTEM_IDENTITY_SOURCE;
  role_name: SYSTEM_USER_ROLE_NAME;
  user_guid: string;
}

const systemUsers: SystemUserSeed[] = [
  {
    identifier: 'achirico',
    type: SYSTEM_IDENTITY_SOURCE.IDIR,
    role_name: SYSTEM_USER_ROLE_NAME.SYSTEM_ADMINISTRATOR,
    user_guid: 'E3A279530D164485BF43C6FE7A49E175'
  },
  {
    identifier: 'mauberti',
    type: SYSTEM_IDENTITY_SOURCE.IDIR,
    role_name: SYSTEM_USER_ROLE_NAME.SYSTEM_ADMINISTRATOR,
    user_guid: '62EC624E50844486A046DC9709854F8D'
  },
  {
    identifier: 'anthomps',
    type: SYSTEM_IDENTITY_SOURCE.IDIR,
    role_name: SYSTEM_USER_ROLE_NAME.SYSTEM_ADMINISTRATOR,
    user_guid: '543C3CE2F4DE472DB3A569FD0024B244'
  },
  {
    identifier: 'ameijer',
    type: SYSTEM_IDENTITY_SOURCE.IDIR,
    role_name: SYSTEM_USER_ROLE_NAME.SYSTEM_ADMINISTRATOR,
    user_guid: '74231b32026141a7acec6bcc0284f038'
  },
  {
    identifier: 'dylrogow',
    type: SYSTEM_IDENTITY_SOURCE.IDIR,
    role_name: SYSTEM_USER_ROLE_NAME.SYSTEM_ADMINISTRATOR,
    user_guid: '473C7CDAC46D402AA79AE980DDDB85C3'
  },
  {
    identifier: 'abushara',
    type: SYSTEM_IDENTITY_SOURCE.IDIR,
    role_name: SYSTEM_USER_ROLE_NAME.SYSTEM_ADMINISTRATOR,
    user_guid: '9266B99E3E9C42339D9F951CBB6E3494'
  }
];

/**
 * Insert system_user rows for each member of the development team if they don't already exist in the system user table.
 *
 * Note: This seed will only be necessary while there is no in-app functionality to manage users.
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`
    set schema '${DB_SCHEMA}';
    set search_path = ${DB_SCHEMA};
  `);

  for (const systemUser of systemUsers) {
    // check if user is already in the system users table
    const response = await knex.raw(`
      ${getSystemUserSQL(systemUser)}
    `);

    // if the fetch returns no rows, then the user is not in the system users table and should be added
    if (!response?.rows?.[0]) {
      // Add system user
      await knex.raw(`
        ${insertSystemUserSQL(systemUser)}
      `);

      // Add system administrator role
      await knex.raw(`
        ${insertSystemUserRoleSQL(systemUser)}
      `);
    }
  }
}

/**
 * SQL to fetch an existing system user row.
 *
 * @param {SystemUserSeed} systemUser
 */
const getSystemUserSQL = (systemUser: SystemUserSeed) => `
  SELECT
    user_identifier
  FROM
    "system_user"
  WHERE
    LOWER(user_identifier) = LOWER('${systemUser.identifier}');
`;

/**
 * SQL to insert a system user row.
 *
 * @param {SystemUserSeed} systemUser
 */
const insertSystemUserSQL = (systemUser: SystemUserSeed) => `
  INSERT INTO "system_user" (
    user_identity_source_id,
    user_identifier,
    user_guid,
    record_effective_date,
    create_date,
    create_user
  )
  SELECT
    user_identity_source_id,
    '${systemUser.identifier}',
    LOWER('${systemUser.user_guid}'),
    now(),
    now(),
    (SELECT system_user_id from "system_user" where LOWER(user_identifier) = LOWER('${DB_ADMIN}'))
  FROM
    user_identity_source
  WHERE
    LOWER(name) = LOWER('${systemUser.type}')
  AND
    record_end_date is null;
`;

/**
 * SQL to insert a system user role row.
 *
 * @param {SystemUserSeed} systemUser
 */
const insertSystemUserRoleSQL = (systemUser: SystemUserSeed) => `
  INSERT INTO system_user_role (
    system_user_id,
    system_role_id
  ) VALUES (
    (SELECT system_user_id from "system_user" where LOWER(user_identifier) = LOWER('${systemUser.identifier}')),
    (SELECT system_role_id from system_role where LOWER(name) = LOWER('${systemUser.role_name}'))
  );
`;
