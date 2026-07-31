import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';

/**
 * Regression coverage for direct team ownership on submissions and submission uploads.
 */
describe('submission team ownership migration (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  it('removes the join table and requires both team_id columns', async () => {
    const response = await connection.sql(SQL`
      SELECT
        to_regclass('biohub.submission_team') AS submission_team,
        (
          SELECT is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'biohub'
            AND table_name = 'submission'
            AND column_name = 'team_id'
        ) AS submission_team_id_nullable,
        (
          SELECT is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'biohub'
            AND table_name = 'submission_upload'
            AND column_name = 'team_id'
        ) AS submission_upload_team_id_nullable;
    `);

    expect(response.rows[0]).to.deep.equal({
      submission_team: null,
      submission_team_id_nullable: 'NO',
      submission_upload_team_id_nullable: 'NO'
    });
  });

  it('assigns a distinct team to every persisted submission and submission upload', async () => {
    const response = await connection.sql(SQL`
      SELECT
        (SELECT COUNT(*)::integer FROM submission) AS submission_count,
        (SELECT COUNT(DISTINCT team_id)::integer FROM submission) AS submission_team_count,
        (SELECT COUNT(*)::integer FROM submission_upload) AS upload_count,
        (SELECT COUNT(DISTINCT team_id)::integer FROM submission_upload) AS upload_team_count;
    `);

    expect(response.rows[0].submission_team_count).to.equal(response.rows[0].submission_count);
    expect(response.rows[0].upload_team_count).to.equal(response.rows[0].upload_count);
  });

  it('does not add users to migration-generated teams', async () => {
    const response = await connection.sql(SQL`
      SELECT COUNT(*)::integer AS member_count
      FROM team
      JOIN team_member
        ON team_member.team_id = team.team_id
       AND team_member.record_end_date IS NULL
      WHERE team.record_end_date IS NULL
        AND team.name IN (
          'Submission Team ' || team.team_id,
          'Submission Upload Team ' || team.team_id
        );
    `);

    expect(response.rows[0].member_count).to.equal(0);
  });

  it('does not install database functions that assign teams', async () => {
    const response = await connection.sql(SQL`
      SELECT proname
      FROM pg_proc
      JOIN pg_namespace
        ON pg_namespace.oid = pg_proc.pronamespace
      WHERE pg_namespace.nspname = 'biohub'
        AND proname IN (
          'tr_submission_set_team_id',
          'tr_submission_upload_set_team_id',
          'tr_submission_team_mirror_upload_access',
          'tr_submission_upload_mirror_legacy_access'
        );
    `);

    expect(response.rowCount).to.equal(0);
  });

  it('rejects a submission insert when the service does not provide a team id', async () => {
    const contributor = await connection.sql(SQL`
      SELECT contributor_id
      FROM contributor
      WHERE record_end_date IS NULL
      ORDER BY contributor_id
      LIMIT 1;
    `);

    try {
      await connection.sql(SQL`
        INSERT INTO submission (
          uuid,
          system_user_id,
          contributor_id,
          name,
          description,
          comment
        )
        VALUES (
          ${randomUUID()},
          ${connection.systemUserId()},
          ${contributor.rows[0].contributor_id},
          'Missing team fixture',
          'Submission insert without a team id.',
          'Integration test'
        );
      `);
      expect.fail('Expected submission.team_id to be required');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiExecuteSQLError);
      expect(JSON.stringify((error as ApiExecuteSQLError).errors)).to.include('team_id');
    }
  });
});
