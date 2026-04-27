import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { createMockDownloadRecord } from '../../__mocks__/download';
import { ApiConflictError } from '../../errors/api-error';
import { DownloadStatusEnum } from '../../models/download-status';
import { FEATURE_PROPERTY_TYPE } from '../../models/feature-property';
import { FeatureTypeWithProperties } from '../../models/feature-type';
import { DownloadExportRepository } from '../../repositories/download/download-export-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { CodeService } from '../code-service';
import { DownloadExportPipelineService } from './download-export-pipeline-service';

chai.use(sinonChai);

const EXPORT_ID = 'dddd0000-0000-0000-0000-000000000001';
const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000042';

/**
 * Test factory: build a DownloadExportRecord with sensible defaults. Callers
 * override the fields that matter for the specific test.
 */
const createMockExportRecord = (overrides?: Partial<Record<string, unknown>>) => ({
  download_export_id: EXPORT_ID,
  download_id: DOWNLOAD_ID,
  format: 'csv',
  status: DownloadStatusEnum.PENDING,
  mode: 'per_feature_type' as const,
  max_part_size_bytes: '524288000',
  started_at: null,
  completed_at: null,
  error_message: null,
  ...overrides
});

describe('DownloadExportPipelineService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('transitionExportStatus', () => {
    it('throws ApiConflictError when current status is not in allowedCurrentStatuses (illegal transition)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadExportRepository.prototype, 'getDownloadExportById')
        .resolves(createMockExportRecord({ status: DownloadStatusEnum.READY }) as any);
      const updateStub = sinon.stub(DownloadExportRepository.prototype, 'updateDownloadExportStatus').resolves();

      try {
        await service.transitionExportStatus(EXPORT_ID, DownloadStatusEnum.READY, [DownloadStatusEnum.PROCESSING]);
        expect.fail('expected throw');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiConflictError);
        expect(err.message).to.equal('Invalid download export status transition');
      }

      expect(updateStub.called).to.be.false;
    });

    it('sets started_at in repo call on pending→processing transition', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadExportRepository.prototype, 'getDownloadExportById')
        .resolves(createMockExportRecord({ status: DownloadStatusEnum.PENDING }) as any);
      const updateStub = sinon.stub(DownloadExportRepository.prototype, 'updateDownloadExportStatus').resolves();

      await service.transitionExportStatus(EXPORT_ID, DownloadStatusEnum.PROCESSING, [DownloadStatusEnum.PENDING]);

      expect(updateStub.calledOnce).to.be.true;
      expect(updateStub.firstCall.args[0]).to.equal(EXPORT_ID);
      expect(updateStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      const metadata = updateStub.firstCall.args[2] as {
        started_at?: string;
        completed_at?: string;
        error_message?: string;
      };
      expect(metadata.started_at).to.be.a('string');
      expect(new Date(metadata.started_at!).toISOString()).to.equal(metadata.started_at);
      expect(metadata.completed_at).to.be.undefined;
    });

    it('sets completed_at in repo call on processing→ready transition', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadExportRepository.prototype, 'getDownloadExportById')
        .resolves(createMockExportRecord({ status: DownloadStatusEnum.PROCESSING }) as any);
      const updateStub = sinon.stub(DownloadExportRepository.prototype, 'updateDownloadExportStatus').resolves();

      await service.transitionExportStatus(EXPORT_ID, DownloadStatusEnum.READY, [DownloadStatusEnum.PROCESSING]);

      const metadata = updateStub.firstCall.args[2] as {
        started_at?: string;
        completed_at?: string;
        error_message?: string;
      };
      expect(metadata.started_at).to.be.undefined;
      expect(metadata.completed_at).to.be.a('string');
    });

    it('sets completed_at and error_message in repo call on processing→failed transition', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadExportRepository.prototype, 'getDownloadExportById')
        .resolves(createMockExportRecord({ status: DownloadStatusEnum.PROCESSING }) as any);
      const updateStub = sinon.stub(DownloadExportRepository.prototype, 'updateDownloadExportStatus').resolves();

      await service.transitionExportStatus(
        EXPORT_ID,
        DownloadStatusEnum.FAILED,
        [DownloadStatusEnum.PENDING, DownloadStatusEnum.PROCESSING],
        { error: 'oops' }
      );

      const metadata = updateStub.firstCall.args[2] as {
        started_at?: string;
        completed_at?: string;
        error_message?: string;
      };
      expect(metadata.error_message).to.equal('oops');
      expect(metadata.completed_at).to.be.a('string');
    });
  });

  describe('listExportFeatureTypes', () => {
    it('returns empty array when no artifacts exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'listDownloadArtifactsByDownloadId').resolves([]);

      const result = await service.listExportFeatureTypes(DOWNLOAD_ID);

      expect(result).to.deep.equal([]);
    });

    it('extracts feature type names from valid Parquet keys', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'listDownloadArtifactsByDownloadId').resolves([
        {
          artifact_id: 'bbbb0000-0000-0000-0000-000000000001',
          object_key: `downloads/${DOWNLOAD_ID}/dataset/data.parquet`
        },
        {
          artifact_id: 'bbbb0000-0000-0000-0000-000000000002',
          object_key: `downloads/${DOWNLOAD_ID}/observation/data.parquet`
        }
      ]);

      const result = await service.listExportFeatureTypes(DOWNLOAD_ID);

      expect(result).to.have.members(['dataset', 'observation']);
      expect(result).to.have.lengthOf(2);
    });

    it('filters out non-Parquet artifacts', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'listDownloadArtifactsByDownloadId').resolves([
        {
          artifact_id: 'bbbb0000-0000-0000-0000-000000000001',
          object_key: `downloads/${DOWNLOAD_ID}/observation/data.parquet`
        },
        {
          artifact_id: 'bbbb0000-0000-0000-0000-000000000002',
          object_key: `downloads/${DOWNLOAD_ID}/exports/${EXPORT_ID}/biohub-${EXPORT_ID}-part-1.zip`
        }
      ]);

      const result = await service.listExportFeatureTypes(DOWNLOAD_ID);

      expect(result).to.deep.equal(['observation']);
    });
  });

  describe('runExport', () => {
    const mockCodes: FeatureTypeWithProperties[] = [
      {
        feature_type: { feature_type_id: 1, name: 'observation', display_name: 'Observation' },
        properties: [
          {
            feature_type_property_id: 1,
            name: 'species',
            display_name: 'Species',
            description: 'Species',
            type_name: FEATURE_PROPERTY_TYPE.STRING,
            required_value: false,
            calculated_value: false
          }
        ]
      }
    ];

    it('transitions PROCESSING then READY on happy path', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadExportRepository.prototype, 'getDownloadExportById')
        .resolves(createMockExportRecord({ status: DownloadStatusEnum.PENDING }) as any);
      sinon.stub(DownloadRepository.prototype, 'getDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);

      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionExportStatus').resolves();
      sinon.stub(DownloadExportPipelineService.prototype, 'listExportFeatureTypes').resolves(['observation']);
      sinon
        .stub(DownloadExportPipelineService.prototype, 'writeFeatureTypeExport')
        .resolves({ finalPart: 1, chunksWritten: 1, fileRefs: [] });
      sinon
        .stub(DownloadExportPipelineService.prototype, 'writePartZip')
        .resolves({ artifactId: 'bbbb0000-0000-0000-0000-000000000010', byteCount: 128 });

      await service.runExport(EXPORT_ID);

      expect(transitionStub.callCount).to.equal(2);
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      expect(transitionStub.firstCall.args[2]).to.deep.equal([
        DownloadStatusEnum.PENDING,
        DownloadStatusEnum.PROCESSING
      ]);
      expect(transitionStub.secondCall.args[1]).to.equal(DownloadStatusEnum.READY);
      expect(transitionStub.secondCall.args[2]).to.deep.equal([DownloadStatusEnum.PROCESSING]);
    });

    it('throws when no Parquet artifacts exist for the download (avoids empty-zip output)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadExportRepository.prototype, 'getDownloadExportById')
        .resolves(createMockExportRecord({ status: DownloadStatusEnum.PENDING }) as any);
      sinon.stub(DownloadRepository.prototype, 'getDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);

      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionExportStatus').resolves();
      sinon.stub(DownloadExportPipelineService.prototype, 'listExportFeatureTypes').resolves([]);
      const writeStub = sinon.stub(DownloadExportPipelineService.prototype, 'writeFeatureTypeExport');
      const writePartStub = sinon.stub(DownloadExportPipelineService.prototype, 'writePartZip');

      try {
        await service.runExport(EXPORT_ID);
        expect.fail('expected throw');
      } catch (err: any) {
        expect(err.message).to.include('no Parquet artifacts');
      }

      // Only PROCESSING fired — READY was never reached, and no work was done.
      expect(transitionStub.calledOnce).to.be.true;
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      expect(writeStub.called).to.be.false;
      expect(writePartStub.called).to.be.false;
    });

    it('throws when every feature type resolves to zero rows (avoids empty-zip output)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadExportRepository.prototype, 'getDownloadExportById')
        .resolves(createMockExportRecord({ status: DownloadStatusEnum.PENDING }) as any);
      sinon.stub(DownloadRepository.prototype, 'getDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);

      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionExportStatus').resolves();
      sinon.stub(DownloadExportPipelineService.prototype, 'listExportFeatureTypes').resolves(['observation']);
      sinon
        .stub(DownloadExportPipelineService.prototype, 'writeFeatureTypeExport')
        .resolves({ finalPart: 1, chunksWritten: 0, fileRefs: [] });
      const writePartStub = sinon.stub(DownloadExportPipelineService.prototype, 'writePartZip');

      try {
        await service.runExport(EXPORT_ID);
        expect.fail('expected throw');
      } catch (err: any) {
        expect(err.message).to.include('zero rows');
      }

      // READY never fired, and no part-zips were finalized.
      expect(transitionStub.calledOnce).to.be.true;
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      expect(writePartStub.called).to.be.false;
    });

    it('propagates error from writeFeatureTypeExport and does not transition to READY', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadExportRepository.prototype, 'getDownloadExportById')
        .resolves(createMockExportRecord({ status: DownloadStatusEnum.PENDING }) as any);
      sinon.stub(DownloadRepository.prototype, 'getDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);

      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionExportStatus').resolves();
      sinon.stub(DownloadExportPipelineService.prototype, 'listExportFeatureTypes').resolves(['observation']);
      sinon.stub(DownloadExportPipelineService.prototype, 'writeFeatureTypeExport').rejects(new Error('boom'));
      const writePartStub = sinon.stub(DownloadExportPipelineService.prototype, 'writePartZip').resolves({
        artifactId: 'bbbb0000-0000-0000-0000-000000000010',
        byteCount: 0
      });

      try {
        await service.runExport(EXPORT_ID);
        expect.fail('expected throw');
      } catch (err: any) {
        expect(err.message).to.equal('boom');
      }

      // Only the PROCESSING transition fired — READY was never reached.
      expect(transitionStub.calledOnce).to.be.true;
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      // writePartZip must not fire either — the error aborted the part loop
      // before any finalize.
      expect(writePartStub.called).to.be.false;
    });
  });
});
