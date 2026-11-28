import { expect } from 'chai';
import { randomUUID } from 'crypto';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { TeamAuthorizationRepository } from '../../repositories/authorization/team-authorization-repository';
import { SubmissionFeaturePropertyRepository } from '../../repositories/submission-feature-property-repository';
import { SubmissionFeatureRepository } from '../../repositories/submission-feature-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { SubmissionService } from '../../services/submission-service';
import {
  createBlueprintFeatureTypeProperty,
  insertSubmissionFeaturePropertyFeature
} from '../helpers/test-feature-property-helpers';
import { createTestFeature } from '../helpers/test-submission-helpers';

/**
 * A submission's team reads the submission's features through the access policy created with the submission, matched
 * against the feature rows without the closure. Fixtures roll back per test.
 */
describe('Submission team feature access (integration)', function () {
  this.timeout(20000);
  let connection: IDBConnection;
  let submissionId: number;
  let teamId: string;

  before(() => initDBPool(defaultPoolConfig));

  beforeEach(async () => {
    sinon
      .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
      .resolves({ status: 'published', jobId: 'stub-job-id' });

    connection = getAPIUserDBConnection();
    await connection.open();

    await connection.sql(SQL`
      INSERT INTO contributor (client_id, description)
      SELECT 'SIMS', 'Integration test contributor'
      WHERE NOT EXISTS (SELECT 1 FROM contributor WHERE client_id = 'SIMS' AND record_end_date IS NULL);
    `);
    const contributor = await connection.sql(SQL`
      SELECT contributor_id FROM contributor WHERE client_id = 'SIMS' AND record_end_date IS NULL LIMIT 1;
    `);

    const created = await new SubmissionService(connection).insertSubmissionRecord({
      uuid: randomUUID(),
      system_user_id: connection.systemUserId(),
      contributor_id: contributor.rows[0].contributor_id,
      name: 'Team Access Submission',
      description: 'description',
      comment: 'comment',
      default_blueprint_id: null
    });
    submissionId = created.submission_id;

    const submission = await connection.sql(SQL`SELECT team_id FROM submission WHERE submission_id = ${submissionId};`);
    teamId = submission.rows[0].team_id;
  });

  afterEach(async () => {
    sinon.restore();
    await connection.rollback();
    connection.release();
  });

  /**
   * Create a published feature and return its id and upload.
   */
  const createFeature = async (featureTypeName = 'survey') => {
    const submissionFeatureId = await createTestFeature(connection, submissionId, featureTypeName, {});
    const row = await connection.sql(SQL`
      SELECT submission_upload_id FROM submission_feature WHERE submission_feature_id = ${submissionFeatureId};
    `);
    return { submissionFeatureId, submissionUploadId: row.rows[0].submission_upload_id as string };
  };

  it("grants the new submission's team an approved policy over the whole submission", async () => {
    const grant = await connection.sql(SQL`
      SELECT p.status, ss.urn_submission_id, ss.urn_feature_type, ss.urn_feature_id
      FROM team_policy tp
      JOIN policy p ON p.policy_id = tp.policy_id
      JOIN policy_statement ps ON ps.policy_id = p.policy_id
      JOIN security_scope ss ON ss.security_scope_id = ps.security_scope_id
      JOIN team_security_scope tss ON tss.team_id = tp.team_id AND tss.security_scope_id = ss.security_scope_id
      WHERE tp.team_id = ${teamId} AND tp.record_end_date IS NULL;
    `);

    expect(grant.rows).to.eql([
      { status: 'approved', urn_submission_id: String(submissionId), urn_feature_type: '*', urn_feature_id: '*' }
    ]);
  });

  it('lists published features by lifecycle and unreviewed features only through their upload', async () => {
    const current = await createFeature();
    const superseded = await createFeature();
    const unreviewed = await createFeature();

    await connection.sql(SQL`
      UPDATE submission_feature
      SET successor_submission_feature_id = ${current.submissionFeatureId}, record_end_date = now()
      WHERE submission_feature_id = ${superseded.submissionFeatureId};
    `);
    await connection.sql(SQL`
      UPDATE submission_feature SET record_effective_date = NULL
      WHERE submission_feature_id = ${unreviewed.submissionFeatureId};
    `);

    const repository = new SubmissionRepository(connection);
    const userId = connection.systemUserId();
    const ids = (rows: { submission_feature_id: number }[]) => rows.map((row) => row.submission_feature_id);

    expect(ids(await repository.getSubmissionFeatures(submissionId, userId, { lifecycle: 'current' }))).to.eql([
      current.submissionFeatureId
    ]);
    expect(ids(await repository.getSubmissionFeatures(submissionId, userId, { lifecycle: 'superseded' }))).to.eql([
      superseded.submissionFeatureId
    ]);
    expect(
      ids(await repository.getSubmissionFeatures(submissionId, userId, { lifecycle: 'all' })).sort((a, b) => a - b)
    ).to.eql([current.submissionFeatureId, superseded.submissionFeatureId].sort((a, b) => a - b));
    expect(await repository.getSubmissionFeaturesCount(submissionId, userId, { lifecycle: 'current' })).to.equal(1);

    expect(
      ids(await repository.getSubmissionUploadFeatures(submissionId, unreviewed.submissionUploadId, userId))
    ).to.eql([unreviewed.submissionFeatureId]);
    expect(
      ids(await repository.getSubmissionUploadFeatures(submissionId, superseded.submissionUploadId, userId))
    ).to.eql([superseded.submissionFeatureId]);
  });

  it('authorizes a member for unreviewed features of the submission, and nothing else', async () => {
    const unreviewed = await createFeature();
    await connection.sql(SQL`
      UPDATE submission_feature SET record_effective_date = NULL
      WHERE submission_feature_id = ${unreviewed.submissionFeatureId};
    `);
    const otherSubmission = await connection.sql(SQL`
      SELECT submission_feature_id FROM submission_feature WHERE submission_id <> ${submissionId} LIMIT 1;
    `);

    const repository = new TeamAuthorizationRepository(connection);
    const userId = connection.systemUserId();

    expect(await repository.isSubmissionFeatureGrantedToUser(userId, submissionId, unreviewed.submissionFeatureId)).to
      .be.true;
    expect(
      await repository.isSubmissionFeatureGrantedToUser(userId + 100000, submissionId, unreviewed.submissionFeatureId)
    ).to.be.false;

    if (otherSubmission.rows.length) {
      const otherFeatureId = otherSubmission.rows[0].submission_feature_id;
      expect(await repository.isSubmissionFeatureGrantedToUser(userId, submissionId, otherFeatureId)).to.be.false;
    }
  });

  it("hides every feature once the team's grant is revoked", async () => {
    const current = await createFeature();
    await connection.sql(SQL`DELETE FROM team_security_scope WHERE team_id = ${teamId};`);

    const userId = connection.systemUserId();

    expect(
      await new SubmissionRepository(connection).getSubmissionFeatures(submissionId, userId, { lifecycle: 'all' })
    ).to.eql([]);
    expect(
      await new SubmissionRepository(connection).getSubmissionUploadFeatures(
        submissionId,
        current.submissionUploadId,
        userId
      )
    ).to.eql([]);
    expect(
      await new TeamAuthorizationRepository(connection).isSubmissionFeatureGrantedToUser(
        userId,
        submissionId,
        current.submissionFeatureId
      )
    ).to.be.false;
  });

  it('reads a feature through its submission at any lifecycle stage, and the public read only when published', async () => {
    const current = await createFeature();
    const superseded = await createFeature();
    const unreviewed = await createFeature();
    await connection.sql(SQL`
      UPDATE submission_feature
      SET successor_submission_feature_id = ${current.submissionFeatureId}, record_end_date = now()
      WHERE submission_feature_id = ${superseded.submissionFeatureId};
    `);
    await connection.sql(SQL`
      UPDATE submission_feature SET record_effective_date = NULL
      WHERE submission_feature_id = ${unreviewed.submissionFeatureId};
    `);

    const repository = new SubmissionFeatureRepository(connection);

    const currentRead = await repository.getSubmissionFeatureBySubmissionId(submissionId, current.submissionFeatureId);
    expect(currentRead.terminal_submission_feature_id).to.equal(current.submissionFeatureId);

    const supersededRead = await repository.getSubmissionFeatureBySubmissionId(
      submissionId,
      superseded.submissionFeatureId
    );
    expect(supersededRead.successor_submission_feature_id).to.equal(current.submissionFeatureId);
    expect(supersededRead.terminal_submission_feature_id).to.equal(current.submissionFeatureId);

    const unreviewedRead = await repository.getSubmissionFeatureBySubmissionId(
      submissionId,
      unreviewed.submissionFeatureId
    );
    expect(unreviewedRead.terminal_submission_feature_id).to.be.null;
    expect(unreviewedRead.successor_submission_feature_id).to.be.null;

    try {
      await repository.getSubmissionFeatureBySubmissionId(submissionId + 100000, current.submissionFeatureId);
      expect.fail('Expected not found for another submission');
    } catch (error_) {
      expect((error_ as Error).message).to.equal('Submission feature not found');
    }

    expect((await repository.getSubmissionFeatureById(current.submissionFeatureId)).submission_feature_id).to.equal(
      current.submissionFeatureId
    );
    try {
      await repository.getSubmissionFeatureById(unreviewed.submissionFeatureId);
      expect.fail('Expected the public read to refuse an unpublished feature');
    } catch (error_) {
      expect((error_ as Error).message).to.equal('Failed to get submission feature record');
    }
  });

  it("returns an unreviewed feature's properties", async () => {
    const { blueprintFeatureTypePropertyId } = await createBlueprintFeatureTypeProperty(
      connection,
      'sample_period',
      'sample_site'
    );
    const target = await createFeature('sample_site');
    const source = await createFeature('sample_period');
    await insertSubmissionFeaturePropertyFeature(
      connection,
      source.submissionFeatureId,
      blueprintFeatureTypePropertyId,
      target.submissionFeatureId
    );
    await connection.sql(SQL`
      UPDATE submission_feature SET record_effective_date = NULL
      WHERE submission_feature_id = ${source.submissionFeatureId};
    `);

    const propertyRepository = new SubmissionFeaturePropertyRepository(connection);
    const rows = await propertyRepository.getSubmissionFeaturePropertiesBySubmissionId(
      submissionId,
      source.submissionFeatureId,
      { page: 1, limit: 25 }
    );

    expect(rows.some((row) => row.id.startsWith('feature:'))).to.be.true;
    expect(
      await propertyRepository.getSubmissionFeaturePropertiesCountBySubmissionId(
        submissionId,
        source.submissionFeatureId
      )
    ).to.be.greaterThan(0);
    expect(
      await propertyRepository.getSubmissionFeaturePropertiesBySubmissionId(
        submissionId + 100000,
        source.submissionFeatureId,
        { page: 1, limit: 25 }
      )
    ).to.eql([]);
    expect(
      await propertyRepository.getSubmissionFeatureProperties(source.submissionFeatureId, { page: 1, limit: 25 })
    ).to.eql([]);
  });
});
