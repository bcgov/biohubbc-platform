import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SECURITY_APPLIED_STATUS } from '../../repositories/security-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { secureFeature } from '../helpers/test-rbac-helpers';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

/** Submission metadata survives empty or temporarily unavailable search graphs. Fixtures roll back per test. */
describe('Submission detail (integration)', function () {
  this.timeout(15000);
  let connection: IDBConnection;
  let repository: SubmissionRepository;

  before(() => initDBPool(defaultPoolConfig));

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    repository = new SubmissionRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  it('returns metadata and an empty feature list for a submission without features', async () => {
    const submissionId = await createTestSubmission(connection);
    const result = await repository.getSubmissionRecordBySubmissionIdWithSecurity(submissionId);
    expect(result.submission_id).to.equal(submissionId);
    expect(result.name).to.equal('Integration Test Submission');
    expect(result.contributor_name).to.equal('SIMS');
    expect(result.feature_types).to.eql([]);
    expect(result.last_approved_upload_date).to.equal(null);
    expect(result.security).to.equal(SECURITY_APPLIED_STATUS.UNSECURED);
  });

  it('keeps metadata available while a closure is invalidated and restores the feature types after rebuilding', async () => {
    const submissionId = await createTestSubmission(connection);
    const root = await createTestFeature(connection, submissionId, 'survey', {});
    await createTestFeature(connection, submissionId, 'animal', {}, root);
    await secureFeature(connection, root);
    const closure = new SubmissionFeatureClosureService(connection);
    await closure.computeClosureForSubmission(submissionId);
    const before = await repository.getSubmissionRecordBySubmissionIdWithSecurity(submissionId);
    expect(before.feature_types).to.eql(['survey', 'animal']);
    expect(before.security).to.equal(SECURITY_APPLIED_STATUS.PARTIALLY_SECURED);

    await closure.invalidateClosureForSubmission(submissionId);
    const pending = await repository.getSubmissionRecordBySubmissionIdWithSecurity(submissionId);
    expect(pending.submission_id).to.equal(submissionId);
    expect(pending.name).to.equal(before.name);
    expect(pending.last_approved_upload_date).to.equal(before.last_approved_upload_date);
    expect(pending.feature_types).to.eql([]);
    expect(pending.security).to.equal(SECURITY_APPLIED_STATUS.PENDING);

    await closure.computeClosureForSubmission(submissionId);
    const rebuilt = await repository.getSubmissionRecordBySubmissionIdWithSecurity(submissionId);
    expect(rebuilt.feature_types).to.eql(before.feature_types);
    expect(rebuilt.security).to.equal(before.security);
  });

  it('returns metadata after all features have ended, excluding their stale closure and security', async () => {
    const submissionId = await createTestSubmission(connection);
    const feature = await createTestFeature(connection, submissionId, 'survey', {});
    await secureFeature(connection, feature);
    await new SubmissionFeatureClosureService(connection).computeClosureForSubmission(submissionId);
    await connection.sql(SQL`
      UPDATE submission_feature SET record_end_date = now() WHERE submission_feature_id = ${feature};
    `);
    const result = await repository.getSubmissionRecordBySubmissionIdWithSecurity(submissionId);
    expect(result.submission_id).to.equal(submissionId);
    expect(result.feature_types).to.eql([]);
    expect(result.security).to.equal(SECURITY_APPLIED_STATUS.UNSECURED);
    expect(result.last_approved_upload_date).to.be.a('string');
  });
});
