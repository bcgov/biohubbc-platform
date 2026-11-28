import { expect } from 'chai';
import crypto from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { IFlattenedBlock } from '../../models/submission-feature';
import { FeaturePropertyRepository } from '../../repositories/feature-property-repository';
import { FeatureTypeService } from '../../services/feature-type-service';
import { SubmissionFeatureIngestionService } from '../../services/ingestion/submission-feature-ingestion-service';
import { SubmissionFeaturePropertyIngestionService } from '../../services/ingestion/submission-feature-property-ingestion-service';
import { SubmissionFeaturePropertyService } from '../../services/submission-feature-property-service';
import { validateSearchFeatureType } from '../../utils/search-feature-validation';
import {
  addPropertyValue,
  createAssignedFeatureProperty,
  createTestUpload,
  insertPendingFeature
} from '../helpers/test-feature-property-helpers';
import { createTestSubmission, getActiveDefaultBlueprintId } from '../helpers/test-submission-helpers';

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

  it('lists the properties of a feature type created and submitted in mixed case, by the name in the tab URL', async () => {
    const featureTypeService = new FeatureTypeService(connection);
    const submittedName = `Linework${crypto.randomInt(0, 1_000_000_000)}`;
    const featureType = await featureTypeService.createFeatureType({ name: submittedName, display_name: 'Linework' });
    const blueprintId = await getActiveDefaultBlueprintId(connection);
    await connection.sql(SQL`
      INSERT INTO blueprint_feature_type (blueprint_id, feature_type_id)
      VALUES (${blueprintId}, ${featureType.feature_type_id})
    `);
    const property = await createAssignedFeatureProperty(connection, 'string', [featureType.name]);
    const propertyName = await connection.sql(
      SQL`SELECT name FROM feature_property WHERE feature_property_id = ${property.featurePropertyId}`
    );
    const feature: IFlattenedBlock = {
      id: 'linework-1',
      type: submittedName,
      properties: { [propertyName.rows[0].name]: 'Fence line' },
      content: [],
      parent: null
    };
    const ingestionService = new SubmissionFeatureIngestionService(connection);
    const knownFeatureTypeMap = await ingestionService.getKnownFeatureTypeMap();
    await ingestionService.ingestFeatureBatch(submissionId, submissionUploadId, [feature], knownFeatureTypeMap);
    const indexingService = new SubmissionFeaturePropertyIngestionService(connection);
    const outcome = await indexingService.indexSubmissionPropertiesBySubmissionUploadId(
      submissionId,
      submissionUploadId
    );

    // The tab URL carries the stored name, which the endpoint normalizes before the lookup.
    const service = new SubmissionFeaturePropertyService(connection);
    const properties = await service.getSubmissionUploadFeatureTypeProperties(
      submissionId,
      submissionUploadId,
      validateSearchFeatureType(featureType.name)
    );

    expect(outcome.status).to.equal('ok');
    expect(properties.map((row) => row.feature_property_id)).to.eql([property.featurePropertyId]);
  });
});
