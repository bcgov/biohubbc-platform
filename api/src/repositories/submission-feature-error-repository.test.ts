import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionFeatureErrorRepository } from './submission-feature-error-repository';

chai.use(sinonChai);

describe('SubmissionFeatureErrorRepository', () => {
  const submissionUploadId = '11111111-1111-4111-8111-111111111111';

  afterEach(() => {
    sinon.restore();
  });

  describe('listSubmissionFeatureErrors', () => {
    it('scopes errors to the upload before limiting and uses a stable tie-breaker', async () => {
      const execute = sinon.stub().resolves({ rows: [], rowCount: 0 });
      const repo = new SubmissionFeatureErrorRepository(getMockDBConnection({ knex: execute }));
      const result = await repo.listSubmissionFeatureErrors(submissionUploadId, { page: 3, limit: 10 });
      const query = execute.firstCall.args[0].toSQL();

      expect(result).to.eql([]);
      expect(execute).to.have.been.calledOnce;
      expect(query.sql).to.include('"sfe"."submission_upload_id" = ?');
      expect(query.sql).to.include('order by "count" desc, "sfe"."submission_feature_error_id" asc');
      expect(query.bindings).to.eql([submissionUploadId, 10, 20]);
    });

    it('orders by the requested column and direction', async () => {
      const execute = sinon.stub().resolves({ rows: [], rowCount: 0 });
      const repo = new SubmissionFeatureErrorRepository(getMockDBConnection({ knex: execute }));
      await repo.listSubmissionFeatureErrors(submissionUploadId, {
        page: 1,
        limit: 25,
        sort: 'error_code',
        order: 'asc'
      });
      const query = execute.firstCall.args[0].toSQL();

      expect(query.sql).to.include('order by "error_code" asc, "sfe"."submission_feature_error_id" asc');
    });

    it('names the feature type of the property assignment each error refers to and can order by it', async () => {
      const execute = sinon.stub().resolves({ rows: [], rowCount: 0 });
      const repo = new SubmissionFeatureErrorRepository(getMockDBConnection({ knex: execute }));
      await repo.listSubmissionFeatureErrors(submissionUploadId, {
        page: 1,
        limit: 25,
        sort: 'feature_type_name',
        order: 'asc'
      });
      const query = execute.firstCall.args[0].toSQL();

      expect(query.sql).to.include('"ft"."name" as "feature_type_name"');
      expect(query.sql).to.include(
        'left join "blueprint_feature_type_property" as "bftp" on "bftp"."blueprint_feature_type_property_id" = "sfe"."blueprint_feature_type_property_id"'
      );
      expect(query.sql).to.include(
        'left join "blueprint_feature_type" as "bft" on "bft"."blueprint_feature_type_id" = "bftp"."blueprint_feature_type_id"'
      );
      expect(query.sql).to.include(
        'left join "feature_type" as "ft" on "ft"."feature_type_id" = "bft"."feature_type_id"'
      );
      expect(query.sql).to.include('order by "feature_type_name" asc, "sfe"."submission_feature_error_id" asc');
    });
  });

  describe('countSubmissionFeatureErrors', () => {
    it('counts only errors of the same upload, including zero matches', async () => {
      const execute = sinon.stub().resolves({ rows: [{ count: 0 }], rowCount: 1 });
      const repo = new SubmissionFeatureErrorRepository(getMockDBConnection({ knex: execute }));
      expect(await repo.countSubmissionFeatureErrors(submissionUploadId)).to.equal(0);
      const query = execute.firstCall.args[0].toSQL();
      expect(query.sql).to.include('"submission_upload_id" = ?');
      expect(query.bindings).to.eql([submissionUploadId]);
      expect(execute).to.have.been.calledOnce;
    });
  });
});
