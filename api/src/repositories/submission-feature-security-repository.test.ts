import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { NormalizedExpressionTree } from '../models/expression-tree-internal';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';
import { SubmissionFeatureSecurityRepository } from './submission-feature-security-repository';

chai.use(sinonChai);

/**
 * Build a normalized single-predicate string equality expression.
 *
 * @param {string} value Value the predicate compares against.
 * @returns {NormalizedExpressionTree} Normalized expression tree.
 */
function equalsExpression(value: string): NormalizedExpressionTree {
  return {
    type: 'expression',
    operator: 'AND',
    clauses: [
      {
        type: 'predicate',
        feature_property_id: 5,
        blueprint_feature_type_property_id: null,
        operator: 'Equals',
        value,
        feature_property_type_id: 1,
        feature_property_type_name: FEATURE_PROPERTY_TYPE.STRING,
        internal_predicate: { type: 'string', operator: 'Equals', value }
      }
    ]
  };
}

describe('SubmissionFeatureSecurityRepository', () => {
  describe('insertScreenedSubmissionFeatureSecurity', () => {
    afterEach(() => sinon.restore());

    it('returns zero counts without querying when no rule is screened', async () => {
      const knex = sinon.stub();
      const repository = new SubmissionFeatureSecurityRepository(getMockDBConnection({ knex }));

      const result = await repository.insertScreenedSubmissionFeatureSecurity({
        submissionId: 1,
        submissionUploadId: 'upload-id',
        rules: [],
        submissionUploadSecurityId: 9001
      });

      expect(result).to.eql({ matched_feature_count: 0, inserted_count: 0 });
      expect(knex).not.to.have.been.called;
    });

    it('evaluates every rule over the upload in one statement and attributes assignments to the event', async () => {
      const knex = sinon.stub().resolves({ rows: [{ matched_feature_count: 4, inserted_count: 3 }], rowCount: 1 });
      const repository = new SubmissionFeatureSecurityRepository(getMockDBConnection({ knex }));

      const result = await repository.insertScreenedSubmissionFeatureSecurity({
        submissionId: 1,
        submissionUploadId: 'upload-id',
        rules: [
          { securityRuleId: 1101, expression: equalsExpression('first') },
          { securityRuleId: 1102, expression: equalsExpression('second') }
        ],
        submissionUploadSecurityId: 9001
      });

      const { sql, bindings } = knex.firstCall.args[0].toSQL().toNative();
      expect(sql.match(/with recursive "upload_features"/g)).to.have.lengthOf(2);
      expect(sql).to.include('union all');
      expect(sql).to.include('ON CONFLICT (submission_feature_id, security_rule_id)');
      expect(sql).to.include('submission_upload_security_id = EXCLUDED.submission_upload_security_id');
      expect(sql).to.include('submission_upload_review_id = NULL');
      expect(sql).to.include('count(DISTINCT submission_feature_id) FROM matches');
      expect(sql).not.to.include('submission_feature_closure');
      expect(bindings.filter((binding: unknown) => binding === 1101 || binding === 1102)).to.eql([1101, 1102]);
      expect(bindings.at(-1)).to.equal(9001);
      expect(result).to.eql({ matched_feature_count: 4, inserted_count: 3 });
    });
  });

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
