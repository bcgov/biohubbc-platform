import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;
const DB_ADMIN = process.env.DB_ADMIN;
const SERVICE_ACCOUNT_PREFIX = 'service-account-';

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
  /** Keycloak display name. Optional: omit to exercise the user_identifier fallback in the app. */
  display_name?: string;
}

const systemUsers: SystemUserSeed[] = [
  {
    identifier: 'achirico',
    type: SYSTEM_IDENTITY_SOURCE.IDIR,
    role_name: SYSTEM_USER_ROLE_NAME.SYSTEM_ADMINISTRATOR,
    user_guid: 'E3A279530D164485BF43C6FE7A49E175',
    display_name: 'Chirico, Albert WLRS:EX'
  },
  {
    identifier: 'mauberti',
    type: SYSTEM_IDENTITY_SOURCE.IDIR,
    role_name: SYSTEM_USER_ROLE_NAME.SYSTEM_ADMINISTRATOR,
    user_guid: '62EC624E50844486A046DC9709854F8D',
    display_name: 'Aubertin-Young, Macgregor WLRS:EX'
  },
  {
    identifier: 'anthomps',
    type: SYSTEM_IDENTITY_SOURCE.IDIR,
    role_name: SYSTEM_USER_ROLE_NAME.SYSTEM_ADMINISTRATOR,
    user_guid: '543C3CE2F4DE472DB3A569FD0024B244',
    display_name: 'Thompson, Andrew WLRS:EX'
  },
  {
    identifier: 'ameijer',
    type: SYSTEM_IDENTITY_SOURCE.IDIR,
    role_name: SYSTEM_USER_ROLE_NAME.SYSTEM_ADMINISTRATOR,
    user_guid: '74231b32026141a7acec6bcc0284f038',
    display_name: 'Meijer, Annika WLRS:EX'
  },
  {
    identifier: 'drogowsk',
    type: SYSTEM_IDENTITY_SOURCE.IDIR,
    role_name: SYSTEM_USER_ROLE_NAME.SYSTEM_ADMINISTRATOR,
    user_guid: '2B9B0C48587E41D68A184E8D772EEA11',
    display_name: 'Rogowsky, Dylan WLRS:IN'
  },
  {
    // No display_name: exercises the user_identifier fallback in user selectors.
    identifier: 'dahogan',
    type: SYSTEM_IDENTITY_SOURCE.IDIR,
    role_name: SYSTEM_USER_ROLE_NAME.SYSTEM_ADMINISTRATOR,
    user_guid: '6936047233B94EA0B8C0698F6349E027'
  }
];

/**
 * Insert system_user rows for each member of the development team if they don't already exist in the system user table.
 *
 * Note: This seed will only be necessary while there is no in-app functionality to manage users.
 */
export async function seed(knex: Knex): Promise<void> {
  const contributorClientId = process.env.KEYCLOAK_CLIENT_ID;
  const contributorSystemUserGuidSuffix = process.env.CONTRIBUTOR_SYSTEM_USER_GUID;
  const contributorSystemUserGuid = `${SERVICE_ACCOUNT_PREFIX}${contributorSystemUserGuidSuffix}`;

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

  if (contributorClientId) {
    await knex.raw(`
      ${insertContributorSQL(contributorClientId)}
    `);
  }

  if (contributorSystemUserGuid) {
    await knex.raw(`
      ${insertSystemServiceAccountUserSQL(contributorSystemUserGuid)}
    `);

    if (contributorClientId) {
      await knex.raw(`
        ${insertContributorSystemUserSQL(contributorClientId, contributorSystemUserGuid)}
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
    display_name,
    record_effective_date,
    create_date,
    create_user
  )
  SELECT
    user_identity_source_id,
    '${systemUser.identifier}',
    LOWER('${systemUser.user_guid}'),
    ${systemUser.display_name ? `'${systemUser.display_name.replace(/'/g, "''")}'` : 'NULL'},
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
 * SQL to insert a contributor system user by GUID if it does not already exist.
 *
 * @param {string} contributorSystemUserGuid
 */
const insertSystemServiceAccountUserSQL = (contributorSystemUserGuid: string) => `
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
    '${contributorSystemUserGuid}',
    LOWER('${contributorSystemUserGuid}'),
    now(),
    now(),
    1
  FROM
    user_identity_source
  WHERE
    LOWER(name) = LOWER('${SYSTEM_IDENTITY_SOURCE.SYSTEM}')
  AND
    record_end_date is null
  AND
    NOT EXISTS (
      SELECT 1
      FROM "system_user" su
      WHERE
        (
          LOWER(su.user_identifier) = LOWER('${contributorSystemUserGuid}')
          OR LOWER(su.user_guid) = LOWER('${contributorSystemUserGuid}')
        )
      AND su.record_end_date is null
    );
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

/**
 * SQL to insert a contributor row if it does not already exist.
 *
 * @param {string} contributorClientId
 */
const insertContributorSQL = (contributorClientId: string) => `
  INSERT INTO contributor (
    client_id,
    description,
    create_user
  )
  SELECT
    '${contributorClientId}',
    'Seeded contributor for system users',
    1
  WHERE NOT EXISTS (
      SELECT 1
      FROM contributor
      WHERE LOWER(client_id) = LOWER('${contributorClientId}')
        AND record_end_date IS NULL
    );
`;

/**
 * SQL to join seeded system users to the contributor.
 *
 * @param {string} contributorClientId
 * @param {string} contributorSystemUserGuid
 */
const insertContributorSystemUserSQL = (contributorClientId: string, contributorSystemUserGuid: string) => `
  WITH seeded_system_user AS (
    SELECT su.system_user_id
    FROM "system_user" su
    WHERE su.record_end_date IS NULL
      AND (
        LOWER(su.user_identifier) IN (${systemUsers.map((user) => `'${user.identifier.toLowerCase()}'`).join(', ')})
        OR LOWER(su.user_guid) = LOWER('${contributorSystemUserGuid}')
      )
  )
  INSERT INTO contributor_system_user (
    contributor_id,
    system_user_id,
    create_user
  )
  SELECT
    c.contributor_id,
    ssu.system_user_id,
    ssu.system_user_id
  FROM contributor c
  CROSS JOIN seeded_system_user ssu
  WHERE LOWER(c.client_id) = LOWER('${contributorClientId}')
    AND c.record_end_date IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM contributor_system_user csu
      WHERE csu.system_user_id = ssu.system_user_id
        AND csu.record_end_date IS NULL
    )
  ON CONFLICT DO NOTHING;
`;
