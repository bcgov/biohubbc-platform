import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ReconciliationFeatureScope, ReconciliationType } from '../../models/reconciliation';
import { SubmissionFeatureReconciliationRepository } from '../../repositories/reconciliation/submission-feature-reconciliation-repository';
import { SearchFeatureRepository } from '../../repositories/search-feature-repository';
import { SubmissionUploadReconciliationService } from '../../services/reconciliation/submission-upload-reconciliation-service';
import { SearchFeatureService } from '../../services/search-feature-service';
import { createTestUpload, insertPendingFeature } from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

// All fixtures and lifecycle changes are rolled back after each test.
describe('Reconciliation feature browsing (integration)', function () {
  this.timeout(30000);
  let connection: IDBConnection;
  let scope: ReconciliationFeatureScope;
  let service: SearchFeatureService;

  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    const submissionId = await createTestSubmission(connection);
    const submissionUploadId = await createTestUpload(connection, submissionId);
    scope = { submissionId, submissionUploadId, reconciliation: 'unmodified' };
    service = new SearchFeatureService(connection);
  });
  afterEach(async () => {
    await connection.rollback();
    await connection.release();
  });

  /**
   * Insert a pending feature and its stored reconciliation classification.
   * @param {string} featureType Seeded feature type.
   * @param {ReconciliationType} outcome Classification stored on the new row.
   * @returns {Promise<number>} Inserted feature identifier.
   */
  async function insertFeature(featureType: string, outcome: ReconciliationType): Promise<number> {
    const id = await insertPendingFeature(connection, scope.submissionId, scope.submissionUploadId, featureType);
    await connection.sql(
      SQL`UPDATE submission_feature SET reconciliation = ${outcome}::submission_feature_reconciliation_type WHERE submission_feature_id = ${id}`
    );
    return id;
  }

  it('matches overview counts across feature lifecycles and excludes other uploads and outcomes', async () => {
    const first = await insertFeature('animal', 'unmodified');
    const second = await insertFeature('animal', 'unmodified');
    const survey = await insertFeature('survey', 'unmodified');
    await insertFeature('animal', 'new');
    await insertFeature('animal', 'modified');
    await insertPendingFeature(connection, scope.submissionId, scope.submissionUploadId, 'animal');
    await connection.sql(
      SQL`UPDATE submission_feature SET record_end_date = now() WHERE submission_feature_id = ${second}`
    );
    const otherUpload = await createTestUpload(connection, scope.submissionId);
    const other = await insertPendingFeature(connection, scope.submissionId, otherUpload, 'animal');
    await connection.sql(
      SQL`UPDATE submission_feature SET reconciliation = 'unmodified' WHERE submission_feature_id = ${other}`
    );
    const filters = { reconciliation: scope.reconciliation };
    const featureTypes = await service.listSubmissionUploadFeatureTypes(scope, filters, { page: 1, limit: 10 });
    const overview = await new SubmissionFeatureReconciliationRepository(
      connection
    ).getSubmissionFeatureReconciliationOverviewCounts(scope.submissionUploadId);
    expect(overview.unmodified).to.equal(3);
    expect(featureTypes.pagination.total).to.equal(2);
    expect(featureTypes.feature_types).to.deep.equal([
      { feature_type_name: 'animal', count: 2 },
      { feature_type_name: 'survey', count: 1 }
    ]);
    const secondPage = await service.listSubmissionUploadFeatureTypes(scope, filters, {
      page: 2,
      limit: 1,
      sort: 'count',
      order: 'desc'
    });
    expect(secondPage.feature_types).to.deep.equal([{ feature_type_name: 'survey', count: 1 }]);
    const page = await new SubmissionUploadReconciliationService(connection).getReconciliationFeatureData(scope, {
      page: 1,
      limit: 10
    });
    expect(page.features.map((row) => row.submission_feature_id)).to.deep.equal([first, second, survey]);
    expect(page.features[0].data).to.be.an('object');
    expect(page.pagination.total).to.equal(3);
    expect(
      await new SearchFeatureRepository(connection).listSubmissionUploadFeatureTypes(
        { ...scope, submissionId: -1 },
        filters,
        { page: 1, limit: 10 }
      )
    ).to.deep.equal([]);
  });

  it('returns empty counts and pages for an outcome without matches', async () => {
    const featureTypes = await service.listSubmissionUploadFeatureTypes(
      scope,
      { reconciliation: scope.reconciliation },
      { page: 1, limit: 10 }
    );
    expect(featureTypes.feature_types).to.deep.equal([]);
    expect(featureTypes.pagination.total).to.equal(0);
    const page = await new SubmissionUploadReconciliationService(connection).getReconciliationFeatureData(scope, {
      page: 1,
      limit: 10
    });
    expect(page.features).to.deep.equal([]);
    expect(page.pagination.total).to.equal(0);
  });
});
