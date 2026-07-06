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
      const insertStub = sinon.stub(FeatureIngestionRepository.prototype, 'insertSubmissionUploadFeatures').resolves(2);
      const activeFeatureTypeMap = new Map<string, number>([
        ['survey', 1],
        ['sample_site', 2]
      ]);

      const features: IFlattenedBlock[] = [
        {
          id: 'feature-1',
          type: 'survey',
          properties: { name: 'Test Survey' },
          content: ['feature-2'],
          parent: null,
          universal_id: 'external-survey-1'
        },
        {
          id: 'feature-2',
          type: 'sample_site',
          properties: { name: 'Site A' },
          content: [],
          parent: 'feature-1'
        }
      ];

      await service.ingestFeatureBatch(42, 'submission-upload-1', features, activeFeatureTypeMap);

      expect(insertStub.calledOnce).to.be.true;
      const insertedRows = insertStub.firstCall.args[0] as Array<{
        submissionUploadId: string;
        sourceId: string;
        featureTypeId: number;
        data: IFlattenedBlock;
        dataByteSize: number;
        contentHash: string;
        universalId?: string;
      }>;
      expect(insertedRows).to.have.length(2);

      expect(insertedRows[0]).to.include({
        submissionUploadId: 'submission-upload-1',
        sourceId: 'feature-1',
        featureTypeId: 1,
        universalId: 'external-survey-1'
      });
      expect(insertedRows[0].data).to.deep.equal({
        id: 'feature-1',
        type: 'survey',
        properties: { name: 'Test Survey' },
        content: ['feature-2'],
        parent: null,
        universal_id: 'external-survey-1'
      });
      expect(insertedRows[0].dataByteSize).to.be.a('number').and.greaterThan(0);
      expect(insertedRows[0].contentHash).to.match(/^[0-9a-f]{64}$/);
      expect(insertedRows[1].contentHash).to.match(/^[0-9a-f]{64}$/);
      expect(insertedRows[0].contentHash).to.not.equal(insertedRows[1].contentHash);
    });

    it('returns early when batch is empty', async () => {
      const service = new SubmissionFeatureIngestionService(getMockDBConnection());
      const insertStub = sinon.stub(FeatureIngestionRepository.prototype, 'insertSubmissionUploadFeatures').resolves(0);

      await service.ingestFeatureBatch(42, 'submission-upload-1', [], new Map([['survey', 1]]));

      expect(insertStub.called).to.be.false;
    });

    it('skips unknown feature types and only inserts known feature rows', async () => {
      const service = new SubmissionFeatureIngestionService(getMockDBConnection());
      const insertStub = sinon.stub(FeatureIngestionRepository.prototype, 'insertSubmissionUploadFeatures').resolves(1);
      const activeFeatureTypeMap = new Map<string, number>([['survey', 1]]);

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

      await service.ingestFeatureBatch(42, 'submission-upload-1', features, activeFeatureTypeMap);

      expect(insertStub.calledOnce).to.be.true;
      const insertedRows = insertStub.firstCall.args[0] as Array<{ sourceId: string; featureTypeId: number }>;
      expect(insertedRows).to.have.length(1);
      expect(insertedRows[0]).to.include({ sourceId: 'feature-1', featureTypeId: 1 });
    });
  });
  describe('deleteSubmissionUploadFeaturesForSubmissionUploadId', () => {
    it('deletes raw staged features scoped to one submission upload attempt', async () => {
      const service = new SubmissionFeatureIngestionService(getMockDBConnection());
      const deleteStub = sinon
        .stub(FeatureIngestionRepository.prototype, 'deleteSubmissionUploadFeaturesForSubmissionUploadId')
        .resolves();

      await service.deleteSubmissionUploadFeaturesForSubmissionUploadId('submission-upload-1');

      expect(deleteStub.calledOnceWithExactly('submission-upload-1')).to.be.true;
    });
  });

  describe('hasSubmissionFeaturesForSubmissionUploadId', () => {
    it('delegates promoted-feature detection to the ingestion repository', async () => {
      const service = new SubmissionFeatureIngestionService(getMockDBConnection());
      const hasStub = sinon
        .stub(FeatureIngestionRepository.prototype, 'hasSubmissionFeaturesForSubmissionUploadId')
        .resolves(true);

      expect(await service.hasSubmissionFeaturesForSubmissionUploadId('submission-upload-1')).to.equal(true);
      expect(hasStub.calledOnceWithExactly('submission-upload-1')).to.be.true;
    });
  });

  describe('getActiveFeatureTypeMap', () => {
    it('maps active feature type names to identifiers', async () => {
      const service = new SubmissionFeatureIngestionService(getMockDBConnection());
      sinon.stub(FeatureIngestionRepository.prototype, 'getActiveFeatureTypeMap').resolves([
        { feature_type_id: 1, name: 'survey' },
        { feature_type_id: 2, name: 'sample_site' }
      ]);

      expect(await service.getActiveFeatureTypeMap()).to.eql(
        new Map([
          ['survey', 1],
          ['sample_site', 2]
        ])
      );
    });
  });
});
