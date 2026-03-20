import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { IFlattenedBlock } from '../../models/submission-feature';
import { IngestionRepository } from '../../repositories/ingestion/ingestion-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { FeatureIngestionService } from './feature-ingestion-service';

describe('FeatureIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('ingestFeatureBatch', () => {
    it('persists shallow-validated feature rows with raw payload and byte size', async () => {
      const service = new FeatureIngestionService(getMockDBConnection());
      const insertStub = sinon.stub(IngestionRepository.prototype, 'insertSubmissionFeatureRecords').resolves();

      const features: IFlattenedBlock[] = [
        {
          id: 'feature-1',
          type: 'dataset',
          properties: { name: 'Test Dataset' },
          content: ['feature-2'],
          parent: null
        },
        {
          id: 'feature-2',
          type: 'sample_site',
          properties: { name: 'Site A' },
          content: [],
          parent: 'feature-1'
        }
      ];

      await service.ingestFeatureBatch(42, 'submission-upload-1', features);

      expect(insertStub.calledOnce).to.be.true;
      const insertedRows = insertStub.firstCall.args[0] as Array<Record<string, unknown>>;
      expect(insertedRows).to.have.length(2);

      expect(insertedRows[0]).to.include({
        submissionId: 42,
        submissionUploadId: 'submission-upload-1',
        sourceId: 'feature-1',
        featureTypeName: 'dataset'
      });
      expect(insertedRows[0].data).to.deep.equal({
        id: 'feature-1',
        type: 'dataset',
        properties: { name: 'Test Dataset' },
        references: ['feature-2'],
        parent: null
      });
      expect(insertedRows[0].dataByteSize).to.be.a('number').and.greaterThan(0);
    });

    it('returns early when batch is empty', async () => {
      const service = new FeatureIngestionService(getMockDBConnection());
      const insertStub = sinon.stub(IngestionRepository.prototype, 'insertSubmissionFeatureRecords').resolves();

      await service.ingestFeatureBatch(42, 'submission-upload-1', []);

      expect(insertStub.called).to.be.false;
    });
  });

  describe('deleteFeaturesBySubmissionUploadId', () => {
    it('soft-deletes features scoped to one submission upload attempt', async () => {
      const service = new FeatureIngestionService(getMockDBConnection());
      const deleteStub = sinon
        .stub(IngestionRepository.prototype, 'deleteSubmissionFeaturesBySubmissionUploadId')
        .resolves();

      await service.deleteFeaturesBySubmissionUploadId('submission-upload-1');

      expect(deleteStub.calledOnceWithExactly('submission-upload-1')).to.be.true;
    });
  });
});
