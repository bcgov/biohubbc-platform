import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { IFlattenedBlock } from '../../models/submission-feature';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { SubmissionFeatureIngestionService } from './submission-feature-ingestion-service';

describe('SubmissionFeatureIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('ingestFeatureBatch', () => {
    it('persists shallow-validated feature rows with raw payload and byte size', async () => {
      const service = new SubmissionFeatureIngestionService(getMockDBConnection());
      const insertStub = sinon
        .stub(FeatureIngestionRepository.prototype, 'insertSubmissionFeatureRecordsByTypeId')
        .resolves(2);
      const knownFeatureTypeMap = new Map<string, number>([
        ['survey', 1],
        ['sample_site', 2]
      ]);

      const features: IFlattenedBlock[] = [
        {
          id: 'feature-1',
          type: 'survey',
          properties: { name: 'Test Survey' },
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

      await service.ingestFeatureBatch(42, 'submission-upload-1', features, knownFeatureTypeMap);

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
        type: 'survey',
        properties: { name: 'Test Survey' },
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

      await service.ingestFeatureBatch(42, 'submission-upload-1', [], new Map([['survey', 1]]));

      expect(insertStub.called).to.be.false;
    });

    it('inserts a retired feature type using its original feature type id', async () => {
      const service = new SubmissionFeatureIngestionService(getMockDBConnection());
      const insertStub = sinon
        .stub(FeatureIngestionRepository.prototype, 'insertSubmissionFeatureRecordsByTypeId')
        .resolves(1);
      const knownFeatureTypeMap = new Map<string, number>([
        ['dataset', 1],
        ['survey', 2]
      ]);
      const feature: IFlattenedBlock = {
        id: 'legacy-feature',
        type: 'dataset',
        properties: { name: 'Legacy Dataset' },
        content: [],
        parent: null
      };

      await service.ingestFeatureBatch(42, 'submission-upload-1', [feature], knownFeatureTypeMap);

      expect(insertStub.calledOnce).to.be.true;
      const insertedRows = insertStub.firstCall.args[0] as Array<{
        submissionId: number;
        submissionUploadId: string;
        sourceId: string;
        featureTypeId: number;
        data: IFlattenedBlock;
      }>;
      expect(insertedRows).to.have.length(1);
      expect(insertedRows[0]).to.include({
        submissionId: 42,
        submissionUploadId: 'submission-upload-1',
        sourceId: 'legacy-feature',
        featureTypeId: 1
      });
      expect(insertedRows[0].data).to.deep.equal(feature);
    });

    it('skips unknown feature types and only inserts known feature rows', async () => {
      const service = new SubmissionFeatureIngestionService(getMockDBConnection());
      const insertStub = sinon
        .stub(FeatureIngestionRepository.prototype, 'insertSubmissionFeatureRecordsByTypeId')
        .resolves(1);
      const knownFeatureTypeMap = new Map<string, number>([['survey', 1]]);

      const features: IFlattenedBlock[] = [
        {
          id: 'feature-1',
          type: 'survey',
          properties: { name: 'Test Survey' },
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

      await service.ingestFeatureBatch(42, 'submission-upload-1', features, knownFeatureTypeMap);

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
