import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { Contributor } from '../../models/contributor';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { SubmissionFeaturePropertyIngestionRepository } from '../../repositories/submission-feature-property-ingestion-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { ContributorService } from '../contributor-service';
import { SubmissionUploadReviewService } from '../upload/submission-upload-review-service';
import { SubmissionFeaturePropertyIngestionService } from './submission-feature-property-ingestion-service';

describe('SubmissionFeaturePropertyIngestionService', () => {
  const contributor: Contributor = { contributor_id: 77, client_id: 'test-client' };

  afterEach(() => {
    sinon.restore();
  });

  it('runs deterministic upload-scoped SQL phases and succeeds when no errors are recorded', async () => {
    const service = new SubmissionFeaturePropertyIngestionService(getMockDBConnection({ systemUserId: () => 11 }));

    sinon.stub(ContributorService.prototype, 'getContributorBySubmissionUploadId').resolves(contributor);
    const requestDefaultReviewsStub = sinon
      .stub(SubmissionUploadReviewService.prototype, 'requestDefaultReviewsForUpload')
      .resolves([]);

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
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'clearTypedPropertyValueStagingBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'clearResolvedPropertyStagingBySubmissionUploadId')
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'clearUploadPropertyWorkingSetStagingBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'populateResolvedPropertyStagingBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'populateTypedPropertyValueStagingBySubmissionUploadId'
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
    const insertCodeStub = sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertCodePropertiesBySubmissionUploadId')
      .resolves();
    const insertTaxonStub = sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'insertTaxonPropertiesBySubmissionUploadId')
      .resolves();
    const insertArtifactStub = sinon
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

    const errorCountStub = sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'getIngestionErrorCountBySubmissionUploadId')
      .resolves(0);
    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(
      99,
      '550e8400-e29b-41d4-a716-446655440000'
    );

    expect(insertStringStub.calledOnce).to.equal(true);
    expect(insertCodeStub.calledOnceWith('550e8400-e29b-41d4-a716-446655440000')).to.equal(true);
    expect(insertTaxonStub.calledOnceWith('550e8400-e29b-41d4-a716-446655440000')).to.equal(true);
    expect(insertArtifactStub.calledOnceWith('550e8400-e29b-41d4-a716-446655440000')).to.equal(true);
    expect(insertReferencesStub.calledOnce).to.equal(true);
    expect(
      requestDefaultReviewsStub.calledOnceWith({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        requestedBy: 11
      })
    ).to.equal(true);
    expect(referenceErrorsStub.calledOnce).to.equal(true);
    expect(parentErrorsStub.calledOnce).to.equal(true);
    expect(outcome).to.eql({ status: 'ok' });

    sinon.assert.callOrder(
      deleteDerivedPropertiesStub,
      deleteRelationshipsStub,
      stageStub,
      deleteErrorsStub,
      requiredStub,
      primitiveStub,
      codeErrorsStub,
      taxonErrorsStub,
      artifactErrorsStub,
      parentErrorsStub,
      referenceErrorsStub,
      datetimeErrorsStub,
      spatialErrorsStub,
      errorCountStub,
      updateParentsStub,
      insertStringStub,
      insertTimestampStub,
      insertGeometryStub,
      insertCodeStub,
      insertTaxonStub,
      insertArtifactStub,
      insertReferencesStub,
      requestDefaultReviewsStub
    );
  });

  it('returns invalid outcome when validation errors exist', async () => {
    const service = new SubmissionFeaturePropertyIngestionService(getMockDBConnection());

    sinon.stub(ContributorService.prototype, 'getContributorBySubmissionUploadId').resolves(contributor);
    const requestDefaultReviewsStub = sinon
      .stub(SubmissionUploadReviewService.prototype, 'requestDefaultReviewsForUpload')
      .resolves([]);
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'deletePropertyRecordsBySubmissionUploadId')
      .resolves();
    sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatureRelationshipsBySubmissionUploadId').resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'deleteIngestionErrorsBySubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'stageExpandedPropertiesBySubmissionUploadId')
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'clearTypedPropertyValueStagingBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'clearResolvedPropertyStagingBySubmissionUploadId')
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'clearUploadPropertyWorkingSetStagingBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'populateResolvedPropertyStagingBySubmissionUploadId'
      )
      .resolves();
    sinon
      .stub(
        SubmissionFeaturePropertyIngestionRepository.prototype,
        'populateTypedPropertyValueStagingBySubmissionUploadId'
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
    const insertStringStub = sinon
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
    const insertRelationshipsStub = sinon
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
      .stub(SubmissionFeaturePropertyIngestionRepository.prototype, 'getIngestionErrorSummariesBySubmissionUploadId')
      .resolves([
        {
          property_name: 'count',
          feature_type_property_id: 22,
          error_code: 'TYPE_MISMATCH',
          error_message: 'Property value type mismatch',
          count: 2,
          details: null
        }
      ]);
    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(
      99,
      '550e8400-e29b-41d4-a716-446655440000'
    );

    expect(insertStringStub.called).to.equal(false);
    expect(insertRelationshipsStub.called).to.equal(false);
    expect(requestDefaultReviewsStub.called).to.equal(false);
    expect(outcome.status).to.equal('invalid');
    if (outcome.status === 'invalid') {
      expect(outcome.errorCount).to.equal(2);
      expect(outcome.errorCounts).to.eql([{ error_code: 'TYPE_MISMATCH', error_count: 2 }]);
      expect(outcome.errorSummaries).to.have.length(1);
    }
  });
});
