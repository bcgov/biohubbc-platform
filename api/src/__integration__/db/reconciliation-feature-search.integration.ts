import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ReconciliationFeatureScope, ReconciliationType } from '../../models/reconciliation';
import { FeaturePropertyRepository } from '../../repositories/feature-property-repository';
import { SubmissionFeatureReconciliationRepository } from '../../repositories/reconciliation/submission-feature-reconciliation-repository';
import { SearchFeatureRepository } from '../../repositories/search-feature-repository';
import { SubmissionFeaturePropertyRepository } from '../../repositories/submission-feature-property-repository';
import { SearchFeatureService } from '../../services/search-feature-service';
import { decodeSearchFeatureCursor } from '../../utils/pagination';
import {
  addPropertyValue,
  createAssignedFeatureProperty,
  createBlueprintFeatureTypeProperty,
  createTestUpload,
  insertPendingFeature,
  insertSubmissionFeaturePropertyFeature
} from '../helpers/test-feature-property-helpers';
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
    await insertFeature('survey', 'unmodified');
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
    const counts = await service.countReconciliationFeatures(scope);
    const overview = await new SubmissionFeatureReconciliationRepository(
      connection
    ).getSubmissionFeatureReconciliationOverviewCounts(scope.submissionUploadId);
    expect(counts.total).to.equal(overview.unmodified).and.to.equal(3);
    expect(counts.feature_types).to.deep.equal([
      { feature_type_name: 'animal', count: 2 },
      { feature_type_name: 'survey', count: 1 }
    ]);
    const page = await service.getReconciliationFeatures(scope, 'animal', {
      limit: 10,
      sort: 'submission_feature_id',
      order: 'asc'
    });
    expect(page.features.map((row) => row.submission_feature_id)).to.deep.equal([first, second]);
    expect(
      await new SearchFeatureRepository(connection).countReconciliationFeatures({ ...scope, submissionId: -1 })
    ).to.deep.equal([]);
  });

  for (const sort of ['submission_feature_id', 'create_date']) {
    for (const order of ['asc', 'desc'] as const) {
      it(`pages forward and backward without gaps using ${sort} ${order}`, async () => {
        const ids: number[] = [];
        for (let index = 0; index < 5; index++) {
          ids.push(await insertFeature('animal', 'unmodified'));
        }
        // All rows share a creation timestamp, exercising the ID tie-breaker.
        await connection.sql(
          SQL`UPDATE submission_feature SET create_date = '2026-01-01T00:00:00Z' WHERE submission_upload_id = ${scope.submissionUploadId}::uuid`
        );
        const ordered = order === 'asc' ? ids : [...ids].reverse();
        const pagination = { limit: 2, sort, order };
        const first = await service.getReconciliationFeatures(scope, 'animal', pagination);
        const second = await service.getReconciliationFeatures(scope, 'animal', {
          ...pagination,
          boundary: decodeSearchFeatureCursor(first.pagination.next_cursor!)
        });
        const third = await service.getReconciliationFeatures(scope, 'animal', {
          ...pagination,
          boundary: decodeSearchFeatureCursor(second.pagination.next_cursor!)
        });
        expect(
          [...first.features, ...second.features, ...third.features].map((row) => row.submission_feature_id)
        ).to.deep.equal(ordered);
        expect(first.pagination.previous_cursor).to.be.null;
        expect(third.pagination.next_cursor).to.be.null;
        const back = await service.getReconciliationFeatures(scope, 'animal', {
          ...pagination,
          boundary: decodeSearchFeatureCursor(third.pagination.previous_cursor!)
        });
        expect(back.features.map((row) => row.submission_feature_id)).to.deep.equal(ordered.slice(2, 4));
      });
    }
  }

  it('hydrates strings, numeric arrays, and references to ended upload rows', async () => {
    const feature = await insertFeature('animal', 'unmodified');
    const target = await insertFeature('survey', 'new');
    const text = await createAssignedFeatureProperty(connection, 'string', ['animal']);
    const numbers = await createAssignedFeatureProperty(connection, 'number', ['animal']);
    await connection.sql(
      SQL`UPDATE blueprint_feature_type_property SET allow_multiple = false WHERE blueprint_feature_type_property_id = ${text.assignments.animal}`
    );
    await addPropertyValue(connection, 'string', feature, text.assignments.animal, 'Elk');
    await addPropertyValue(connection, 'number', feature, numbers.assignments.animal, 4);
    await addPropertyValue(connection, 'number', feature, numbers.assignments.animal, 9);
    const reference = await createBlueprintFeatureTypeProperty(connection, 'animal', 'survey');
    await insertSubmissionFeaturePropertyFeature(connection, feature, reference.blueprintFeatureTypePropertyId, target);
    await connection.sql(
      SQL`UPDATE submission_feature SET record_end_date = now() WHERE submission_feature_id IN (${feature}, ${target})`
    );
    const page = await service.getReconciliationFeatures(scope, 'animal', {
      limit: 10,
      sort: 'submission_feature_id',
      order: 'asc'
    });
    const textName = page.properties.find((property) => property.feature_property_id === text.featurePropertyId)!.name;
    const numberName = page.properties.find(
      (property) => property.feature_property_id === numbers.featurePropertyId
    )!.name;
    expect(page.features[0].properties[textName]).to.equal('Elk');
    expect(page.features[0].properties[numberName]).to.deep.equal([4, 9]);
    expect(page.features[0].properties[reference.propertyName]).to.have.property('urn');
  });

  it('preserves indexed values and columns after their type, property and Blueprint assignment retire', async () => {
    const feature = await insertFeature('animal', 'unmodified');
    const text = await createAssignedFeatureProperty(connection, 'string', ['animal']);
    await addPropertyValue(connection, 'string', feature, text.assignments.animal, 'Retained value');
    await connection.sql(SQL`UPDATE blueprint_feature_type_property SET record_end_date = now()
      WHERE blueprint_feature_type_property_id = ${text.assignments.animal}`);
    await connection.sql(SQL`UPDATE feature_property SET record_end_date = now()
      WHERE feature_property_id = ${text.featurePropertyId}`);
    await connection.sql(SQL`UPDATE feature_type SET record_end_date = now() WHERE name = 'animal'`);
    const page = await service.getReconciliationFeatures(scope, 'animal', {
      limit: 10,
      sort: 'submission_feature_id',
      order: 'asc'
    });
    const property = page.properties.find((item) => item.feature_property_id === text.featurePropertyId);
    expect(property).not.to.be.undefined;
    expect(page.features[0].properties[property!.name]).to.deep.equal(['Retained value']);
    expect((await service.countReconciliationFeatures(scope)).total).to.equal(1);
    const definitions = await new FeaturePropertyRepository(connection).getSubmissionUploadFeatureTypeProperties(
      scope.submissionId,
      scope.submissionUploadId,
      'animal'
    );
    expect(definitions.map((item) => item.feature_property_id)).to.include(text.featurePropertyId);
    const detail = await new SubmissionFeaturePropertyRepository(
      connection
    ).getSubmissionFeaturePropertiesBySubmissionUploadId(scope.submissionUploadId, feature, { page: 1, limit: 25 });
    expect(detail.some((item) => item.value === 'Retained value')).to.equal(true);
  });

  it('hydrates scalar and multiple artifact keys only for the requested feature page', async () => {
    const first = await insertFeature('animal', 'unmodified');
    const second = await insertFeature('animal', 'unmodified');
    const property = await createAssignedFeatureProperty(connection, 'artifact_key', ['animal']);
    for (const [feature, key] of [
      [first, 'report.pdf'],
      [first, 'photo.jpg'],
      [second, 'other.pdf']
    ] as const) {
      const artifact = await connection.sql(SQL`
        INSERT INTO artifact (bucket, object_key, artifact_status, uploaded_at, format, create_user)
        VALUES ('integration-test', ${key}, 'uploaded', now(), 'bin', ${connection.systemUserId()})
        RETURNING artifact_id
      `);
      await connection.sql(SQL`
        INSERT INTO submission_feature_property_artifact
          (submission_feature_id, blueprint_feature_type_property_id, artifact_id, create_user)
        VALUES (${feature}, ${property.assignments.animal}, ${
        artifact.rows[0].artifact_id
      }, ${connection.systemUserId()})
      `);
    }
    const page = await service.getReconciliationFeatures(scope, 'animal', {
      limit: 1,
      sort: 'submission_feature_id',
      order: 'asc'
    });
    const name = page.properties.find((item) => item.feature_property_id === property.featurePropertyId)!.name;
    expect(page.features.map((item) => item.submission_feature_id)).to.deep.equal([first]);
    expect(page.features[0].properties[name]).to.deep.equal(['report.pdf', 'photo.jpg']);
    await connection.sql(SQL`UPDATE blueprint_feature_type_property SET allow_multiple = false
      WHERE blueprint_feature_type_property_id = ${property.assignments.animal}`);
    const next = await service.getReconciliationFeatures(scope, 'animal', {
      limit: 1,
      sort: 'submission_feature_id',
      order: 'asc',
      boundary: decodeSearchFeatureCursor(page.pagination.next_cursor!)
    });
    expect(next.features[0].properties[name]).to.equal('other.pdf');
  });

  it('includes secured rows without published closure', async () => {
    const feature = await insertFeature('animal', 'unmodified');
    await connection.sql(SQL`
      INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, create_user)
      VALUES (${feature}, (SELECT security_rule_id FROM security_rule WHERE name = 'Moose' LIMIT 1), ${connection.systemUserId()})
    `);
    const page = await service.getReconciliationFeatures(scope, 'animal', {
      limit: 10,
      sort: 'submission_feature_id',
      order: 'asc'
    });
    expect(page.features[0].submission_feature_id).to.equal(feature);
    expect(page.features[0].is_secured).to.equal(true);
    expect(page.features[0].provenance).to.equal('direct');
  });

  it('returns empty counts and pages for an outcome without matches', async () => {
    expect(await service.countReconciliationFeatures(scope)).to.deep.equal({ total: 0, feature_types: [] });
    const page = await service.getReconciliationFeatures(scope, 'animal', {
      limit: 10,
      sort: 'submission_feature_id',
      order: 'asc'
    });
    expect(page.features).to.deep.equal([]);
    expect(page.pagination.next_cursor).to.be.null;
    expect(page.pagination.previous_cursor).to.be.null;
  });
});
