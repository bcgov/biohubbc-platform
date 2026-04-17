import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { IFlattenedBlock } from '../../models/submission-feature';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { SubmissionFeatureIngestionService } from './submission-feature-ingestion-service';

describe('SubmissionFeatureIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('ingestFeatureBatch', () => {
    it('persists shallow-validated feature rows with raw payload and byte size', async () => {
      const service = new SubmissionFeatureIngestionService(getMockDBConnection());
      sinon.stub(FeatureIngestionRepository.prototype, 'getActiveFeatureTypeMap').resolves([
        { feature_type_id: 1, name: 'dataset' },
        { feature_type_id: 2, name: 'sample_site' }
      ]);
      const insertStub = sinon
        .stub(FeatureIngestionRepository.prototype, 'insertSubmissionFeatureRecordsByTypeId')
        .resolves(2);

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
      const insertedRows = insertStub.firstCall.args[0] as Array<{
        submissionId: number;
        submissionUploadId: string;
        sourceId: string;
        featureTypeId: number;
        data: IFlattenedBlock;
        dataByteSize: number;
      }>;
      expect(insertedRows).to.have.length(2);

      expect(insertedRows[0]).to.include({
        submissionId: 42,
        submissionUploadId: 'submission-upload-1',
        sourceId: 'feature-1',
        featureTypeId: 1
      });
      expect(insertedRows[0].data).to.deep.equal({
        id: 'feature-1',
        type: 'dataset',
        properties: { name: 'Test Dataset' },
        content: ['feature-2'],
        parent: null
      });
      expect(insertedRows[0].dataByteSize).to.be.a('number').and.greaterThan(0);
    });

    it('returns early when batch is empty', async () => {
      const service = new SubmissionFeatureIngestionService(getMockDBConnection());
      const insertStub = sinon
        .stub(FeatureIngestionRepository.prototype, 'insertSubmissionFeatureRecordsByTypeId')
        .resolves(0);

      await service.ingestFeatureBatch(42, 'submission-upload-1', []);

      expect(insertStub.called).to.be.false;
    });

    it('skips unknown feature types and only inserts known feature rows', async () => {
      const service = new SubmissionFeatureIngestionService(getMockDBConnection());
      sinon
        .stub(FeatureIngestionRepository.prototype, 'getActiveFeatureTypeMap')
        .resolves([{ feature_type_id: 1, name: 'dataset' }]);
      const insertStub = sinon
        .stub(FeatureIngestionRepository.prototype, 'insertSubmissionFeatureRecordsByTypeId')
        .resolves(1);

      const features: IFlattenedBlock[] = [
        {
          id: 'feature-1',
          type: 'dataset',
          properties: { name: 'Test Dataset' },
          content: [],
          parent: null
        },
        {
          id: 'feature-2',
          type: 'unknown_type',
          properties: { name: 'Unknown Feature' },
          content: [],
          parent: null
        }
      ];

      await service.ingestFeatureBatch(42, 'submission-upload-1', features);

      expect(insertStub.calledOnce).to.be.true;
      const insertedRows = insertStub.firstCall.args[0] as Array<{ sourceId: string; featureTypeId: number }>;
      expect(insertedRows).to.have.length(1);
      expect(insertedRows[0]).to.include({ sourceId: 'feature-1', featureTypeId: 1 });
    });
  });

  describe('deleteFeaturesBySubmissionUploadId', () => {
    it('soft-deletes features scoped to one submission upload attempt', async () => {
      const service = new SubmissionFeatureIngestionService(getMockDBConnection());
      const deleteStub = sinon
        .stub(FeatureIngestionRepository.prototype, 'deleteSubmissionFeaturesBySubmissionUploadId')
        .resolves();

      await service.deleteFeaturesBySubmissionUploadId('submission-upload-1');

      expect(deleteStub.calledOnceWithExactly('submission-upload-1')).to.be.true;
    });
  });
});
