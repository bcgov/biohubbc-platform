import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { FeaturePropertyRepository } from '../../repositories/feature-property-repository';
import { SubmissionFeaturePropertyService } from '../../services/submission-feature-property-service';
import {
  addPropertyValue,
  createAssignedFeatureProperty,
  createTestUpload,
  insertPendingFeature
} from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

// Definitions and submitted values are rolled back after each test.
describe('Submission upload feature-type property definitions (integration)', function () {
  this.timeout(30000);
  let connection: IDBConnection;
  let submissionId: number;
  let submissionUploadId: string;

  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    submissionId = await createTestSubmission(connection);
    submissionUploadId = await createTestUpload(connection, submissionId);
  });
  afterEach(async () => {
    await connection.rollback();
    await connection.release();
  });

  it('deduplicates observed definitions across outcomes and historical rows while isolating type and upload', async () => {
    const shared = await createAssignedFeatureProperty(connection, 'string', ['animal']);
    const historical = await createAssignedFeatureProperty(connection, 'number', ['animal']);
    const otherType = await createAssignedFeatureProperty(connection, 'string', ['survey']);
    const otherUploadProperty = await createAssignedFeatureProperty(connection, 'string', ['animal']);
    const unused = await createAssignedFeatureProperty(connection, 'boolean', ['animal']);
    const first = await insertPendingFeature(connection, submissionId, submissionUploadId, 'animal');
    const second = await insertPendingFeature(connection, submissionId, submissionUploadId, 'animal');
    const survey = await insertPendingFeature(connection, submissionId, submissionUploadId, 'survey');
    const otherUpload = await createTestUpload(connection, submissionId);
    const otherFeature = await insertPendingFeature(connection, submissionId, otherUpload, 'animal');
    await addPropertyValue(connection, 'string', first, shared.assignments.animal, 'Elk');
    await addPropertyValue(connection, 'string', first, shared.assignments.animal, 'Moose');
    await addPropertyValue(connection, 'string', second, shared.assignments.animal, 'Elk');
    await addPropertyValue(connection, 'number', second, historical.assignments.animal, 3);
    await addPropertyValue(connection, 'string', survey, otherType.assignments.survey, 'Survey');
    await addPropertyValue(connection, 'string', otherFeature, otherUploadProperty.assignments.animal, 'Other upload');
    await connection.sql(
      SQL`UPDATE submission_feature SET reconciliation = 'new' WHERE submission_feature_id = ${first}`
    );
    await connection.sql(
      SQL`UPDATE submission_feature SET reconciliation = 'unmodified', record_end_date = now() WHERE submission_feature_id = ${second}`
    );
    const service = new SubmissionFeaturePropertyService(connection);
    const properties = await service.getSubmissionUploadFeatureTypeProperties(
      submissionId,
      submissionUploadId,
      'animal'
    );
    const ids = properties.map((property) => property.feature_property_id);
    expect(ids).to.have.members([shared.featurePropertyId, historical.featurePropertyId]);
    expect(properties).to.have.length(2);
    expect(ids).not.to.include(unused.featurePropertyId);
    expect(ids).not.to.include(otherType.featurePropertyId);
    expect(ids).not.to.include(otherUploadProperty.featurePropertyId);
    const repository = new FeaturePropertyRepository(connection);
    expect(await repository.getSubmissionUploadFeatureTypeProperties(-1, submissionUploadId, 'animal')).to.deep.equal(
      []
    );
  });

  it('returns no definitions for a feature type with no stored property values', async () => {
    await insertPendingFeature(connection, submissionId, submissionUploadId, 'animal');
    const service = new SubmissionFeaturePropertyService(connection);
    expect(
      await service.getSubmissionUploadFeatureTypeProperties(submissionId, submissionUploadId, 'animal')
    ).to.deep.equal([]);
  });
});
