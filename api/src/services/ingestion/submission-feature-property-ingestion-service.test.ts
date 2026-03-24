import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { IngestionValidationError } from '../../errors/submission-errors';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { SubmissionFeaturePropertyIngestionRepository } from '../../repositories/submission-feature-property-ingestion-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { ContributorService } from '../contributor-service';
import { SubmissionFeaturePropertyIngestionService } from './submission-feature-property-ingestion-service';

describe('SubmissionFeaturePropertyIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('runs deterministic upload-scoped SQL phases and succeeds when no errors are recorded', async () => {
    const service = new SubmissionFeaturePropertyIngestionService(getMockDBConnection());

    sinon.stub(ContributorService.prototype, 'getContributorBySubmissionId').resolves({ contributor_id: 77 } as any);

    const deleteDerivedPropertiesStub = sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'deletePropertyRecordsBySubmissionUploadId')
      .resolves();
    const deleteRelationshipsStub = sinon
      .stub(SubmissionRepository.prototype, 'deleteSubmissionFeatureRelationshipsBySubmissionUploadId')
      .resolves();
    const deleteErrorsStub = sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'deleteIngestionErrorsBySubmissionUploadId')
      .resolves();
    const stageStub = sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'stageExpandedPropertiesBySubmissionUploadId')
      .resolves();
    const createTempErrorTableStub = sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createIngestionErrorTempTable')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createIngestionErrorTempUploadIndex')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createIngestionErrorTempErrorCodeIndex')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createIngestionErrorTempFeatureIndex')
      .resolves();
    sinon.stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'dropTmpUploadPropertyValuesTable').resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'dropTmpResolvedStagedPropertiesTable')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'dropTmpResolvedFeatureTypePropertyKeysTable')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'dropTmpUploadFeatureTypePropertyKeysTable')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'dropTmpUploadFeatureTypePropertyMapTable')
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpUploadFeatureTypePropertyMapBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpUploadFeatureTypePropertyMapFeatureTypePropertyNameIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpUploadFeatureTypePropertyMapFeatureTypePropertyIdIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpUploadFeatureTypePropertyKeysBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createTmpUploadFeatureTypePropertyKeysIndex')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createTmpResolvedFeatureTypePropertyKeysTable')
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpResolvedFeatureTypePropertyKeysFeatureTypePropertyNameIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpResolvedFeatureTypePropertyKeysFeatureTypePropertyIdIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpResolvedStagedPropertiesBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpResolvedStagedPropertiesSubmissionFeatureIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpResolvedStagedPropertiesFeatureTypePropertyIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpResolvedStagedPropertiesPropertyTypeIndex'
      )
      .resolves();
    sinon.stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createTmpUploadPropertyValuesTable').resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createTmpUploadPropertyValuesPropertyTypeIndex')
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpUploadPropertyValuesFeatureTypePropertyIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpUploadPropertyValuesSubmissionFeatureIndex'
      )
      .resolves();
    const requiredStub = sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordMissingRequiredPropertyErrorsBySubmissionUploadId'
      )
      .resolves();
    const primitiveStub = sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordPrimitiveValidationErrorsBySubmissionUploadId'
      )
      .resolves();
    const codeErrorsStub = sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordCodePropertyResolutionErrorsBySubmissionUploadId'
      )
      .resolves();
    const taxonErrorsStub = sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordTaxonPropertyResolutionErrorsBySubmissionUploadId'
      )
      .resolves();
    const artifactErrorsStub = sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordArtifactPropertyResolutionErrorsBySubmissionUploadId'
      )
      .resolves();

    const datetimeErrorsStub = sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordDatetimeNormalizationErrorsBySubmissionUploadId'
      )
      .resolves();
    const spatialErrorsStub = sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordSpatialNormalizationErrorsBySubmissionUploadId'
      )
      .resolves();

    const insertStringStub = sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertStringPropertiesBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertNumberPropertiesBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertBooleanPropertiesBySubmissionUploadId')
      .resolves();
    const insertTimestampStub = sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertTimestampPropertiesBySubmissionUploadId')
      .resolves();
    const insertGeometryStub = sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertGeometryPropertiesBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertCodePropertiesBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertTaxonPropertiesBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertArtifactLinksBySubmissionUploadId')
      .resolves();

    const insertReferencesStub = sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertFeatureRelationshipsBySubmissionUploadId')
      .resolves();
    const referenceErrorsStub = sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'recordReferenceErrorsBySubmissionUploadId')
      .resolves();
    const updateParentsStub = sinon
      .stub(FeatureIngestionRepository.prototype, 'updateSubmissionFeatureParentsBySubmissionUploadId')
      .resolves();
    const parentErrorsStub = sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'recordUnresolvedParentErrorsBySubmissionUploadId')
      .resolves();

    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'getIngestionErrorCountBySubmissionUploadId')
      .resolves(0);

    await service.indexSubmissionPropertiesBySubmissionUploadId(99, '550e8400-e29b-41d4-a716-446655440000');

    expect(insertStringStub.calledOnce).to.equal(true);
    expect(insertReferencesStub.calledOnce).to.equal(true);
    expect(referenceErrorsStub.calledOnce).to.equal(true);
    expect(parentErrorsStub.calledOnce).to.equal(true);

    sinon.assert.callOrder(
      deleteDerivedPropertiesStub,
      deleteRelationshipsStub,
      createTempErrorTableStub,
      stageStub,
      deleteErrorsStub,
      requiredStub,
      primitiveStub,
      codeErrorsStub,
      taxonErrorsStub,
      artifactErrorsStub,
      parentErrorsStub,
      updateParentsStub,
      datetimeErrorsStub,
      spatialErrorsStub,
      insertStringStub,
      insertTimestampStub,
      insertGeometryStub,
      insertReferencesStub,
      referenceErrorsStub
    );
  });

  it('fails at end with grouped error details when ingestion errors exist', async () => {
    const service = new SubmissionFeaturePropertyIngestionService(getMockDBConnection());

    sinon.stub(ContributorService.prototype, 'getContributorBySubmissionId').resolves({ contributor_id: 77 } as any);
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'deletePropertyRecordsBySubmissionUploadId')
      .resolves();
    sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatureRelationshipsBySubmissionUploadId').resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'deleteStagingRowsBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'deleteIngestionErrorsBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'stageExpandedPropertiesBySubmissionUploadId')
      .resolves();
    sinon.stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createIngestionErrorTempTable').resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createIngestionErrorTempUploadIndex')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createIngestionErrorTempErrorCodeIndex')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createIngestionErrorTempFeatureIndex')
      .resolves();
    sinon.stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'dropTmpUploadPropertyValuesTable').resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'dropTmpResolvedStagedPropertiesTable')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'dropTmpResolvedFeatureTypePropertyKeysTable')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'dropTmpUploadFeatureTypePropertyKeysTable')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'dropTmpUploadFeatureTypePropertyMapTable')
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpUploadFeatureTypePropertyMapBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpUploadFeatureTypePropertyMapFeatureTypePropertyNameIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpUploadFeatureTypePropertyMapFeatureTypePropertyIdIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpUploadFeatureTypePropertyKeysBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createTmpUploadFeatureTypePropertyKeysIndex')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createTmpResolvedFeatureTypePropertyKeysTable')
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpResolvedFeatureTypePropertyKeysFeatureTypePropertyNameIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpResolvedFeatureTypePropertyKeysFeatureTypePropertyIdIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpResolvedStagedPropertiesBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpResolvedStagedPropertiesSubmissionFeatureIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpResolvedStagedPropertiesFeatureTypePropertyIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpResolvedStagedPropertiesPropertyTypeIndex'
      )
      .resolves();
    sinon.stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createTmpUploadPropertyValuesTable').resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'createTmpUploadPropertyValuesPropertyTypeIndex')
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpUploadPropertyValuesFeatureTypePropertyIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'createTmpUploadPropertyValuesSubmissionFeatureIndex'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordMissingRequiredPropertyErrorsBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordPrimitiveValidationErrorsBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordCodePropertyResolutionErrorsBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordTaxonPropertyResolutionErrorsBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordArtifactPropertyResolutionErrorsBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordDatetimeNormalizationErrorsBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'recordSpatialNormalizationErrorsBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertStringPropertiesBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertNumberPropertiesBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertBooleanPropertiesBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertTimestampPropertiesBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertGeometryPropertiesBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertCodePropertiesBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertTaxonPropertiesBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertArtifactLinksBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertFeatureRelationshipsBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'recordReferenceErrorsBySubmissionUploadId')
      .resolves();
    sinon.stub(FeatureIngestionRepository.prototype, 'updateSubmissionFeatureParentsBySubmissionUploadId').resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'recordUnresolvedParentErrorsBySubmissionUploadId')
      .resolves();

    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'getIngestionErrorCountBySubmissionUploadId')
      .resolves(2);
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'getIngestionErrorCountsByCode')
      .resolves([{ error_code: 'TYPE_MISMATCH', error_count: 2 }]);
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'getIngestionErrorSamplesBySubmissionUploadId')
      .resolves([
        {
          submission_feature_id: 11,
          property_name: 'count',
          feature_type_property_id: 22,
          error_code: 'TYPE_MISMATCH',
          error_message: 'Property value type mismatch',
          raw_value: 'bad',
          details: null
        }
      ]);

    try {
      await service.indexSubmissionPropertiesBySubmissionUploadId(99, '550e8400-e29b-41d4-a716-446655440000');
      expect.fail();
    } catch (error) {
      expect(error).to.be.instanceOf(IngestionValidationError);
      expect((error as Error).message).to.contain('validation errors');
    }
  });
});
