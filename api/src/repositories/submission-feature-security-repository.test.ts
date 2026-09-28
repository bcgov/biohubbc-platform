import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionFeatureSecurityRepository } from './submission-feature-security-repository';

chai.use(sinonChai);

describe('SubmissionFeatureSecurityRepository', () => {
  describe('predecessor security copy', () => {
    afterEach(() => sinon.restore());

    it('preserves live predecessor provenance and expiry without changing existing assignments', async () => {
      const sql = sinon.stub().resolves({ rows: [], rowCount: 1 });
      const repository = new SubmissionFeatureSecurityRepository(getMockDBConnection({ sql }));

      await repository.copySubmissionFeatureSecurityToSuccessors('upload-id', 'predecessor-upload-id');

      const statement = sql.firstCall.args[0];
      const text = statement.text as string;
      expect(text).to.include('candidate.submission_id = incoming.submission_id');
      expect(text).to.include('candidate.source_id = incoming.source_id');
      expect(text).to.include('candidate.successor_submission_feature_id IS NULL');
      expect(text).to.include('predecessor_security.submission_upload_review_id');
      expect(text).to.include('predecessor_security.record_effective_date <= now()');
      expect(text).not.to.include('predecessor_security.status');
      expect(text).to.include('predecessor_security.submission_upload_security_id');
      expect(text).to.include('record_effective_date, record_end_date)');
      expect(text).to.match(/now\(\),\s+predecessor_security\.record_end_date\s+FROM/);
      expect(text).to.include('ON CONFLICT (submission_feature_id, security_rule_id) DO NOTHING');
      expect(text).not.to.include('DO UPDATE');
      expect(text).not.to.include('submission_feature_closure');
      expect(statement.values).to.eql(['predecessor-upload-id', 'predecessor-upload-id', 'upload-id']);
    });
  });

  describe('getSubmissionFeatureSecurities', () => {
    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            submission_feature_security_id: 1,
            submission_feature_id: 1,
            security_rule_id: 1,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          },
          {
            submission_feature_security_id: 2,
            submission_feature_id: 1,
            security_rule_id: 2,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          },
          {
            submission_feature_security_id: 3,
            submission_feature_id: 2,
            security_rule_id: 1,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: () => mockQueryResponse
      });

      const repo = new SubmissionFeatureSecurityRepository(mockDBConnection);
      const response = await repo.getSubmissionFeatureSecurities([1, 2]);
      expect(response).to.have.lengthOf(3);
    });
  });
});
