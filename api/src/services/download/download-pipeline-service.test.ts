import * as parquetjs from '@dsnp/parquetjs';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { FRAGMENT_SIZE_THRESHOLD } from '../../constants/download';
import { ApiConflictError } from '../../errors/api-error';
import {
  DownloadArtifactInfo,
  DownloadFeatureData,
  DownloadFeatureSummary,
  DownloadRecord,
  DownloadSource
} from '../../models/download';
import { DownloadFragmentRecord } from '../../models/download-fragment';
import { DownloadStatusEnum } from '../../models/download-status';
import { FEATURE_PROPERTY_TYPE } from '../../models/feature-property';
import { FeatureTypeWithProperties } from '../../models/feature-type';
import { DownloadFragmentRepository } from '../../repositories/download/download-fragment-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
import { CodeService } from '../code-service';
import { ObjectStorageService } from '../object-storage/object-storage-service';
import { SearchFeatureService } from '../search-feature-service';
import { DownloadPipelineService } from './download-pipeline-service';

chai.use(sinonChai);

describe('DownloadPipelineService', () => {
  afterEach(() => {
    sinon.restore();
  });

  // Helper: create a mock download record
  const createMockDownloadRecord = (overrides?: Partial<DownloadRecord>): DownloadRecord => ({
    download_id: 'aaaa0000-0000-0000-0000-000000000042',
    download_status: DownloadStatusEnum.PROCESSING,
    format: 'csv',
    metadata: null,
    started_at: null,
    completed_at: null,
    downloaded_at: null,
    total_fragments: 1,
    completed_fragments: 0,
    estimated_total_size_bytes: null,
    fragment_size_bytes: String(FRAGMENT_SIZE_THRESHOLD),
    create_date: '2025-01-01T00:00:00Z',
    ...overrides
  });

  // Shared helpers for fragment-related tests
  const createMockFragment = (overrides?: Partial<DownloadFragmentRecord>): DownloadFragmentRecord => ({
    download_fragment_id: 1,
    download_id: 'aaaa0000-0000-0000-0000-000000000042',
    fragment_index: 0,
    fragment_status: DownloadStatusEnum.PENDING,
    s3_key: null,
    file_name: null,
    file_size_bytes: null,
    estimated_size_bytes: null,
    feature_count: 2,
    started_at: null,
    completed_at: null,
    error_message: null,
    ...overrides
  });

  async function* mockFeatureStream(features: DownloadFeatureData[]): AsyncGenerator<DownloadFeatureData[]> {
    if (features.length > 0) {
      yield features;
    }
  }

  describe('planDownloadIfNeeded', () => {
    it('throws if download not found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(null);

      try {
        await service.planDownloadIfNeeded('aaaa0000-0000-0000-0000-000000000042');
        expect.fail('Expected an error');
      } catch (error) {
        expect((error as Error).message).to.equal('Download aaaa0000-0000-0000-0000-000000000042 not found');
      }
    });

    it('skips planning when fragments already exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(DownloadFragmentRepository.prototype, 'getFragmentsByDownloadId').resolves([createMockFragment()]);
      const estimateStub = sinon.stub(service, 'estimateDownloadSize');

      await service.planDownloadIfNeeded('aaaa0000-0000-0000-0000-000000000042');

      expect(estimateStub.called).to.be.false;
    });

    it('plans fragments when none exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(DownloadFragmentRepository.prototype, 'getFragmentsByDownloadId').resolves([]);
      const estimateStub = sinon.stub(service, 'estimateDownloadSize').resolves(1000);
      const planStub = sinon.stub(service, 'planFragments').resolves();

      await service.planDownloadIfNeeded('aaaa0000-0000-0000-0000-000000000042');

      expect(estimateStub.calledOnce).to.be.true;
      expect(planStub.calledOnce).to.be.true;
    });
  });

  describe('getFragmentsToProcess', () => {
    it('filters out READY fragments', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const readyFragment = createMockFragment({
        download_fragment_id: 1,
        fragment_status: DownloadStatusEnum.READY
      });
      const pendingFragment = createMockFragment({
        download_fragment_id: 2,
        fragment_status: DownloadStatusEnum.PENDING
      });

      sinon
        .stub(DownloadFragmentRepository.prototype, 'getFragmentsByDownloadId')
        .resolves([readyFragment, pendingFragment]);

      const result = await service.getFragmentsToProcess('aaaa0000-0000-0000-0000-000000000042');

      expect(result).to.have.length(1);
      expect(result[0].download_fragment_id).to.equal(2);
    });
  });

  describe('processFragment', () => {
    it('continues processing when file stream fails and adds error placeholder', async () => {
      // Verifies: Graceful degradation - S3 file error doesn't fail entire fragment

      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const mockFragment = createMockFragment();
      const mockFeatures: DownloadFeatureData[] = [
        {
          submission_feature_id: 30,
          uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          feature_type_name: 'file',
          data: { file: 'uploads/missing-file.jpg', description: 'Missing file' },
          submission_id: 1
        }
      ];

      const updateStatusStub = sinon.stub(DownloadFragmentRepository.prototype, 'updateFragmentStatus').resolves();
      const types = [...new Set(mockFeatures.map((f) => f.feature_type_name))];
      sinon.stub(DownloadFragmentRepository.prototype, 'getFragmentFeatureTypes').resolves(types);
      sinon
        .stub(DownloadFragmentRepository.prototype, 'streamFragmentFeaturesByType')
        .callsFake((_fragmentId: number, typeName: string) => {
          const typeFeatures = mockFeatures.filter((f) => f.feature_type_name === typeName);
          return mockFeatureStream(typeFeatures);
        });
      sinon
        .stub(DownloadFragmentRepository.prototype, 'getRootDatasetsByFragment')
        .resolves(
          new Map<number, { dataset_uuid: string; dataset_name: string | null }>([
            [1, { dataset_name: 'Test Dataset', dataset_uuid: '11111111-2222-3333-4444-555555555555' }]
          ])
        );

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      const mockCodes: FeatureTypeWithProperties[] = [
        {
          feature_type: { feature_type_id: 1, name: 'file', display_name: 'File' },
          properties: [
            {
              feature_type_property_id: 1,
              name: 'artifact_key',
              display_name: 'Artifact Key',
              description: 'Artifact Key',
              type_name: FEATURE_PROPERTY_TYPE.ARTIFACT_KEY,
              required_value: true,
              calculated_value: false
            }
          ]
        }
      ];
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
      sinon.stub(ObjectStorageService.prototype, 'getFileStream').rejects(new Error('NoSuchKey: File not found'));
      const uploadStub = sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();

      // Should NOT throw — graceful degradation
      await service.processFragment(mockFragment, 'aaaa0000-0000-0000-0000-000000000042');

      // Verify: fragment was uploaded and marked READY despite file stream failure
      expect(uploadStub.calledOnce).to.be.true;
      expect(updateStatusStub.calledOnce).to.be.true;
      expect(updateStatusStub.firstCall.args[1]).to.equal(DownloadStatusEnum.READY);
    });

    it('uses multi-fragment naming pattern for downloads with multiple fragments', async () => {
      // Verifies: S3 key uses biohub-{id}-part-{n+1}.zip when total_fragments > 1

      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const pendingFragment = createMockFragment({
        download_fragment_id: 5,
        fragment_index: 1
      });

      sinon.stub(DownloadFragmentRepository.prototype, 'updateFragmentStatus').resolves();
      sinon.stub(DownloadFragmentRepository.prototype, 'getFragmentFeatureTypes').resolves(['observation']);
      sinon.stub(DownloadFragmentRepository.prototype, 'streamFragmentFeaturesByType').callsFake(() =>
        mockFeatureStream([
          {
            submission_feature_id: 10,
            uuid: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
            feature_type_name: 'observation',
            data: { species: 'bear' },
            submission_id: 1
          }
        ])
      );
      sinon
        .stub(DownloadFragmentRepository.prototype, 'getRootDatasetsByFragment')
        .resolves(
          new Map<number, { dataset_uuid: string; dataset_name: string | null }>([
            [1, { dataset_name: 'Test Dataset', dataset_uuid: '11111111-2222-3333-4444-555555555555' }]
          ])
        );
      sinon
        .stub(DownloadRepository.prototype, 'findDownloadById')
        .resolves(createMockDownloadRecord({ total_fragments: 3 }));
      const mockCodes: FeatureTypeWithProperties[] = [
        {
          feature_type: {
            feature_type_id: 2,
            name: 'observation',
            display_name: 'Observation'
          },
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
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
      const uploadStreamStub = sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();

      await service.processFragment(pendingFragment, 'aaaa0000-0000-0000-0000-000000000042');

      expect(uploadStreamStub.calledOnce).to.be.true;
      expect(uploadStreamStub.firstCall.args[3]).to.equal(
        'downloads/aaaa0000-0000-0000-0000-000000000042/biohub-aaaa0000-0000-0000-0000-000000000042-part-2.zip'
      );
    });
  });

  describe('transitionDownloadStatus', () => {
    const downloadId = 'aaaa0000-0000-0000-0000-000000000042';

    it('propagates getDownloadById throw when download does not exist (does NOT call updateDownloadStatus)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'getDownloadById').rejects(new Error('Download not found'));
      const updateStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      try {
        await service.transitionDownloadStatus(downloadId, DownloadStatusEnum.PROCESSING, [DownloadStatusEnum.PENDING]);
        expect.fail('expected throw');
      } catch (err: any) {
        expect(err.message).to.equal('Download not found');
      }

      expect(updateStub.called).to.be.false;
    });

    it('throws ApiConflictError when current status is not in allowedCurrentStatuses (illegal transition)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadById')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.READY }));
      const updateStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      try {
        await service.transitionDownloadStatus(downloadId, DownloadStatusEnum.PROCESSING, [DownloadStatusEnum.PENDING]);
        expect.fail('expected throw');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiConflictError);
        expect(err.message).to.equal('Invalid download status transition');
      }

      expect(updateStub.called).to.be.false;
    });

    it('calls updateDownloadStatus with started_at set for pending→processing', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadById')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.PENDING }));
      const updateStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      await service.transitionDownloadStatus(downloadId, DownloadStatusEnum.PROCESSING, [DownloadStatusEnum.PENDING]);

      expect(updateStub.calledOnce).to.be.true;
      expect(updateStub.firstCall.args[0]).to.equal(downloadId);
      expect(updateStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      const metadata = updateStub.firstCall.args[2] as { started_at?: string; completed_at?: string };
      expect(metadata.started_at).to.be.a('string');
      expect(new Date(metadata.started_at!).toISOString()).to.equal(metadata.started_at);
      expect(metadata.completed_at).to.be.undefined;
    });

    it('calls updateDownloadStatus with completed_at set for processing→ready', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadById')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.PROCESSING }));
      const updateStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      await service.transitionDownloadStatus(downloadId, DownloadStatusEnum.READY, [DownloadStatusEnum.PROCESSING]);

      const metadata = updateStub.firstCall.args[2] as { started_at?: string; completed_at?: string };
      expect(metadata.started_at).to.be.undefined;
      expect(metadata.completed_at).to.be.a('string');
    });

    it('passes completed_at and error metadata for processing→failed', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadById')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.PROCESSING }));
      const updateStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      await service.transitionDownloadStatus(
        downloadId,
        DownloadStatusEnum.FAILED,
        [DownloadStatusEnum.PENDING, DownloadStatusEnum.PROCESSING],
        { error: 'job failed after all retries' }
      );

      const metadata = updateStub.firstCall.args[2] as {
        error?: string;
        started_at?: string;
        completed_at?: string;
      };
      expect(metadata.error).to.equal('job failed after all retries');
      expect(metadata.completed_at).to.be.a('string');
    });
  });

  describe('finalizeDownload', () => {
    it('sets READY status for single-fragment download', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const readyFragment = createMockFragment({
        fragment_status: DownloadStatusEnum.READY,
        s3_key: 'downloads/aaaa0000-0000-0000-0000-000000000042/biohub-aaaa0000-0000-0000-0000-000000000042.zip',
        file_name: 'biohub-aaaa0000-0000-0000-0000-000000000042.zip',
        file_size_bytes: '512'
      });

      sinon.stub(DownloadFragmentRepository.prototype, 'getFragmentsByDownloadId').resolves([readyFragment]);
      const updateCountsStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadFragmentCounts').resolves();
      const updateStatusStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      await service.finalizeDownload('aaaa0000-0000-0000-0000-000000000042');

      expect(updateCountsStub).to.have.been.calledOnceWith('aaaa0000-0000-0000-0000-000000000042', 1, 1);
      expect(updateStatusStub.calledOnce).to.be.true;
      expect(updateStatusStub.firstCall.args[1]).to.equal(DownloadStatusEnum.READY);
      expect(updateStatusStub.firstCall.args[2]).to.have.property('completed_at').that.is.a('string');
    });

    it('sets READY status for multi-fragment download', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const fragment1 = createMockFragment({
        download_fragment_id: 1,
        fragment_status: DownloadStatusEnum.READY,
        file_size_bytes: '1000'
      });
      const fragment2 = createMockFragment({
        download_fragment_id: 2,
        fragment_status: DownloadStatusEnum.READY,
        file_size_bytes: '2000'
      });

      sinon.stub(DownloadFragmentRepository.prototype, 'getFragmentsByDownloadId').resolves([fragment1, fragment2]);
      const updateCountsStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadFragmentCounts').resolves();
      const updateStatusStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      await service.finalizeDownload('aaaa0000-0000-0000-0000-000000000042');

      expect(updateCountsStub).to.have.been.calledOnceWith('aaaa0000-0000-0000-0000-000000000042', 2, 2);
      expect(updateStatusStub.calledOnce).to.be.true;
      expect(updateStatusStub.firstCall.args[1]).to.equal(DownloadStatusEnum.READY);
      expect(updateStatusStub.firstCall.args[2]).to.have.property('completed_at').that.is.a('string');
    });
  });

  describe('estimateDownloadSize', () => {
    it('returns aggregate total for cart-based downloads', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const source: DownloadSource = { cart_id: 'cart-uuid', filters: null, create_user: 1 };
      sinon.stub(DownloadRepository.prototype, 'getDownloadSource').resolves(source);
      sinon.stub(DownloadRepository.prototype, 'getDownloadTotalSizeByCartId').resolves({ total: 200 });

      const result = await service.estimateDownloadSize('aaaa0000-0000-0000-0000-000000000001');

      expect(result).to.equal(200);
    });

    it('returns aggregate total for filter-based downloads', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const source: DownloadSource = { cart_id: null, filters: { keyword: 'moose' }, create_user: 5 };
      sinon.stub(DownloadRepository.prototype, 'getDownloadSource').resolves(source);
      const mockSubquery = { toSQL: () => ({ toNative: () => ({ sql: 'SELECT 1', bindings: [] }) }) } as any;
      sinon.stub(SearchFeatureService.prototype, 'buildSearchFeatureIdsSubquery').returns(mockSubquery);
      sinon.stub(DownloadRepository.prototype, 'getDownloadTotalSizeBySearchQuery').resolves({ total: 5000 });

      const result = await service.estimateDownloadSize('aaaa0000-0000-0000-0000-000000000001');

      expect(result).to.equal(5000);
    });

    it('returns zero when total is null (empty result set)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const source: DownloadSource = { cart_id: 'cart-uuid', filters: null, create_user: 1 };
      sinon.stub(DownloadRepository.prototype, 'getDownloadSource').resolves(source);
      sinon.stub(DownloadRepository.prototype, 'getDownloadTotalSizeByCartId').resolves({ total: null });

      const result = await service.estimateDownloadSize('aaaa0000-0000-0000-0000-000000000001');

      expect(result).to.equal(0);
    });

    it('throws when download has neither cart_id nor filters', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const source: DownloadSource = { cart_id: null, filters: null, create_user: 1 };
      sinon.stub(DownloadRepository.prototype, 'getDownloadSource').resolves(source);

      try {
        await service.estimateDownloadSize('aaaa0000-0000-0000-0000-000000000001');
        expect.fail('Expected an error');
      } catch (error) {
        expect((error as Error).message).to.include('has neither cart_id nor filters');
      }
    });
  });

  // Helper: create a mock async generator for cursor-based streaming
  async function* mockSummaryStream(features: DownloadFeatureSummary[]): AsyncGenerator<DownloadFeatureSummary[]> {
    if (features.length > 0) {
      yield features;
    }
  }

  describe('planFragments', () => {
    it('creates multiple fragments when exceeding threshold (cart-based)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      // Stub source resolution — cart-based download
      const source: DownloadSource = { cart_id: 'cart-uuid', filters: null, create_user: 1 };
      sinon.stub(DownloadRepository.prototype, 'getDownloadSource').resolves(source);
      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(
        createMockDownloadRecord({
          download_id: 'aaaa0000-0000-0000-0000-000000000001',
          fragment_size_bytes: String(FRAGMENT_SIZE_THRESHOLD)
        })
      );

      // Features: 120MB + 120MB + 80MB — first two exceed threshold (200MB), third fits with second
      const oneHundredTwentyMB = 120 * 1024 * 1024;
      const eightyMB = 80 * 1024 * 1024;
      const features: DownloadFeatureSummary[] = [
        {
          submission_feature_id: 10,
          feature_type_name: 'observation',
          estimated_byte_size: String(oneHundredTwentyMB),
          submission_id: 1
        },
        {
          submission_feature_id: 20,
          feature_type_name: 'observation',
          estimated_byte_size: String(oneHundredTwentyMB),
          submission_id: 1
        },
        {
          submission_feature_id: 30,
          feature_type_name: 'observation',
          estimated_byte_size: String(eightyMB),
          submission_id: 1
        }
      ];
      sinon.stub(DownloadRepository.prototype, 'streamDownloadFeaturesByCartId').returns(mockSummaryStream(features));

      const createFragmentStub = sinon.stub(DownloadFragmentRepository.prototype, 'createDownloadFragment');
      createFragmentStub.onFirstCall().resolves({ download_fragment_id: 1 });
      createFragmentStub.onSecondCall().resolves({ download_fragment_id: 2 });
      const createFragmentFeaturesStub = sinon
        .stub(DownloadFragmentRepository.prototype, 'createDownloadFragmentFeatures')
        .resolves();
      const updateFragmentCountsStub = sinon
        .stub(DownloadRepository.prototype, 'updateDownloadFragmentCounts')
        .resolves();
      sinon.stub(DownloadRepository.prototype, 'updateEstimatedTotalSize').resolves();

      const totalBytes = oneHundredTwentyMB * 2 + eightyMB;
      await service.planFragments('aaaa0000-0000-0000-0000-000000000001', totalBytes);

      // Fragment 0: feature 10 (120MB) — flush when adding 20 would exceed 200MB
      // Fragment 1: features 20+30 (120+80=200MB)
      expect(createFragmentStub).to.have.been.calledTwice;
      expect(createFragmentFeaturesStub.firstCall.args[1]).to.deep.equal([10]);
      expect(createFragmentFeaturesStub.secondCall.args[1]).to.deep.equal([20, 30]);
      expect(updateFragmentCountsStub).to.have.been.calledOnceWith('aaaa0000-0000-0000-0000-000000000001', 2);
    });

    it('creates fragments for filter-based downloads using search stream', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      // Stub source resolution — filter-based download
      const source: DownloadSource = { cart_id: null, filters: { keyword: 'moose' }, create_user: 5 };
      sinon.stub(DownloadRepository.prototype, 'getDownloadSource').resolves(source);
      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(
        createMockDownloadRecord({
          download_id: 'aaaa0000-0000-0000-0000-000000000001',
          fragment_size_bytes: String(FRAGMENT_SIZE_THRESHOLD)
        })
      );

      // Mock the search subquery and toSQL extraction
      const mockSubquery = {
        toSQL: () => ({ toNative: () => ({ sql: 'SELECT submission_feature_id FROM ...', bindings: [5] }) })
      } as any;
      const buildSubqueryStub = sinon
        .stub(SearchFeatureService.prototype, 'buildSearchFeatureIdsSubquery')
        .returns(mockSubquery);

      const features: DownloadFeatureSummary[] = [
        { submission_feature_id: 10, feature_type_name: 'observation', estimated_byte_size: '500', submission_id: 1 },
        { submission_feature_id: 20, feature_type_name: 'observation', estimated_byte_size: '300', submission_id: 1 }
      ];
      const streamStub = sinon
        .stub(DownloadRepository.prototype, 'streamDownloadFeaturesBySearchQuery')
        .returns(mockSummaryStream(features));

      // Cart stream should NOT be called
      const cartStreamStub = sinon.stub(DownloadRepository.prototype, 'streamDownloadFeaturesByCartId');

      const createFragmentStub = sinon.stub(DownloadFragmentRepository.prototype, 'createDownloadFragment');
      createFragmentStub.onFirstCall().resolves({ download_fragment_id: 1 });
      const createFragmentFeaturesStub = sinon
        .stub(DownloadFragmentRepository.prototype, 'createDownloadFragmentFeatures')
        .resolves();
      sinon.stub(DownloadRepository.prototype, 'updateDownloadFragmentCounts').resolves();
      sinon.stub(DownloadRepository.prototype, 'updateEstimatedTotalSize').resolves();

      await service.planFragments('aaaa0000-0000-0000-0000-000000000001', 800);

      // Verify filter path was taken
      expect(buildSubqueryStub).to.have.been.calledOnceWith({ keyword: 'moose' }, 5);
      expect(streamStub).to.have.been.calledOnce;
      expect(streamStub.firstCall.args[0]).to.equal('aaaa0000-0000-0000-0000-000000000001');
      expect(streamStub.firstCall.args[1]).to.equal('SELECT submission_feature_id FROM ...');
      expect(streamStub.firstCall.args[2]).to.deep.equal([5]);
      expect(cartStreamStub).to.not.have.been.called;

      // Both features fit in one fragment (800 bytes << 200MB threshold)
      expect(createFragmentStub).to.have.been.calledOnce;
      expect(createFragmentFeaturesStub.firstCall.args[1]).to.deep.equal([10, 20]);
    });

    it('uses custom fragment size from download record instead of default threshold', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const source: DownloadSource = { cart_id: 'cart-uuid', filters: null, create_user: 1 };
      sinon.stub(DownloadRepository.prototype, 'getDownloadSource').resolves(source);

      const oneGB = 1000 * 1024 * 1024;
      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(
        createMockDownloadRecord({
          download_id: 'aaaa0000-0000-0000-0000-000000000001',
          fragment_size_bytes: String(oneGB)
        })
      );

      const threeHundredMB = 300 * 1024 * 1024;
      const twoHundredMB = 200 * 1024 * 1024;
      const features: DownloadFeatureSummary[] = [
        {
          submission_feature_id: 10,
          feature_type_name: 'observation',
          estimated_byte_size: String(threeHundredMB),
          submission_id: 1
        },
        {
          submission_feature_id: 20,
          feature_type_name: 'observation',
          estimated_byte_size: String(threeHundredMB),
          submission_id: 1
        },
        {
          submission_feature_id: 30,
          feature_type_name: 'observation',
          estimated_byte_size: String(twoHundredMB),
          submission_id: 1
        }
      ];
      sinon.stub(DownloadRepository.prototype, 'streamDownloadFeaturesByCartId').returns(mockSummaryStream(features));

      const createFragmentStub = sinon.stub(DownloadFragmentRepository.prototype, 'createDownloadFragment');
      createFragmentStub.onFirstCall().resolves({ download_fragment_id: 1 });
      const createFragmentFeaturesStub = sinon
        .stub(DownloadFragmentRepository.prototype, 'createDownloadFragmentFeatures')
        .resolves();
      const updateFragmentCountsStub = sinon
        .stub(DownloadRepository.prototype, 'updateDownloadFragmentCounts')
        .resolves();
      sinon.stub(DownloadRepository.prototype, 'updateEstimatedTotalSize').resolves();

      const totalBytes = threeHundredMB * 2 + twoHundredMB;
      await service.planFragments('aaaa0000-0000-0000-0000-000000000001', totalBytes);

      // With 1GB threshold, all features fit in 1 fragment
      expect(createFragmentStub).to.have.been.calledOnce;
      expect(createFragmentFeaturesStub.firstCall.args[1]).to.deep.equal([10, 20, 30]);
      expect(updateFragmentCountsStub).to.have.been.calledOnceWith('aaaa0000-0000-0000-0000-000000000001', 1);
    });
  });

  // -------------------------------------------------------------------------
  // Parquet pipeline methods
  // -------------------------------------------------------------------------

  // Shared test data for Parquet tests
  const TEST_DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000042';
  const TEST_ARTIFACT: DownloadArtifactInfo = {
    artifact_id: 'bbbb0000-0000-0000-0000-000000000001',
    object_key: 'downloads/aaaa0000-0000-0000-0000-000000000042'
  };
  const TEST_SOURCE_CART: DownloadSource = {
    cart_id: 'cccc0000-0000-0000-0000-000000000001',
    filters: null,
    create_user: 1
  };
  const TEST_SOURCE_FILTER: DownloadSource = { cart_id: null, filters: { keyword: 'moose' }, create_user: 5 };

  describe('getDownloadMetadata', () => {
    it('returns combined source and artifact info', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const getSourceStub = sinon.stub(DownloadRepository.prototype, 'getDownloadSource').resolves(TEST_SOURCE_CART);
      const getArtifactStub = sinon.stub(DownloadRepository.prototype, 'getDownloadArtifact').resolves(TEST_ARTIFACT);

      const result = await service.getDownloadMetadata(TEST_DOWNLOAD_ID);

      expect(getSourceStub).to.have.been.calledOnceWith(TEST_DOWNLOAD_ID);
      expect(getArtifactStub).to.have.been.calledOnceWith(TEST_DOWNLOAD_ID);
      expect(result.source).to.deep.equal(TEST_SOURCE_CART);
      expect(result.artifact).to.deep.equal(TEST_ARTIFACT);
    });

    it('propagates errors from getDownloadArtifact', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'getDownloadSource').resolves(TEST_SOURCE_CART);
      sinon.stub(DownloadRepository.prototype, 'getDownloadArtifact').rejects(new Error('Artifact not found'));

      try {
        await service.getDownloadMetadata(TEST_DOWNLOAD_ID);
        expect.fail('Expected an error');
      } catch (error) {
        expect((error as Error).message).to.equal('Artifact not found');
      }
    });
  });

  describe('resolveParquetSchema', () => {
    const mockCodes: FeatureTypeWithProperties[] = [
      {
        feature_type: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
        properties: [
          {
            feature_type_property_id: 1,
            name: 'title',
            display_name: 'Title',
            description: 'Title',
            type_name: FEATURE_PROPERTY_TYPE.STRING,
            required_value: true,
            calculated_value: false
          }
        ]
      },
      {
        feature_type: { feature_type_id: 2, name: 'observation', display_name: 'Observation' },
        properties: [
          {
            feature_type_property_id: 2,
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

    it('resolves schema and feature types for cart-based downloads', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
      const listStub = sinon
        .stub(DownloadRepository.prototype, 'listDownloadFeatureTypesByCartId')
        .resolves(['dataset', 'observation']);

      const result = await service.resolveParquetSchema(TEST_DOWNLOAD_ID, TEST_SOURCE_CART);

      expect(listStub).to.have.been.calledOnceWith(TEST_SOURCE_CART.cart_id);
      expect(result.featureTypes).to.deep.equal(['dataset', 'observation']);
      expect(result.schemaLookup.has('dataset')).to.be.true;
      expect(result.schemaLookup.has('observation')).to.be.true;
    });

    it('resolves schema and feature types for filter-based downloads', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
      const mockSubquery = { toSQL: () => ({ toNative: () => ({ sql: 'SELECT 1', bindings: [] }) }) } as any;
      const buildSubqueryStub = sinon
        .stub(SearchFeatureService.prototype, 'buildSearchFeatureIdsSubquery')
        .returns(mockSubquery);
      const listStub = sinon
        .stub(DownloadRepository.prototype, 'listDownloadFeatureTypesBySearchQuery')
        .resolves(['observation']);

      const result = await service.resolveParquetSchema(TEST_DOWNLOAD_ID, TEST_SOURCE_FILTER);

      expect(buildSubqueryStub).to.have.been.calledOnceWith(TEST_SOURCE_FILTER.filters, TEST_SOURCE_FILTER.create_user);
      expect(listStub).to.have.been.calledOnce;
      expect(result.featureTypes).to.deep.equal(['observation']);
    });

    it('throws when download has neither cart_id nor filters', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);

      const noSource: DownloadSource = { cart_id: null, filters: null, create_user: 1 };

      try {
        await service.resolveParquetSchema(TEST_DOWNLOAD_ID, noSource);
        expect.fail('Expected an error');
      } catch (error) {
        expect((error as Error).message).to.include('has neither cart_id nor filters');
      }
    });
  });

  describe('writeFeatureTypeParquet', () => {
    const mockProperties: CsvPropertyDefinition[] = [
      { feature_property_name: 'species', feature_property_type_name: 'string' }
    ];

    const mockSpatialProperties: CsvPropertyDefinition[] = [
      { feature_property_name: 'species', feature_property_type_name: 'string' },
      { feature_property_name: 'location', feature_property_type_name: 'spatial' }
    ];

    // Helper: mock async generator for base feature cursor
    async function* mockBaseCursor(batches: any[][]): AsyncGenerator<any[]> {
      for (const batch of batches) {
        yield batch;
      }
    }

    it('streams features to Parquet via cart path', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const mockWriter = { appendRow: sinon.stub().resolves(), close: sinon.stub().resolves() };
      sinon.stub(parquetjs.ParquetWriter, 'openStream').resolves(mockWriter as any);
      sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();

      const baseBatch = [
        {
          submission_feature_id: 1,
          uuid: 'uuid-1',
          feature_type_name: 'observation',
          data: { properties: {} },
          parent_uuid: 'p-1'
        }
      ];
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByCartIdAndType').returns(mockBaseCursor([baseBatch]));
      sinon
        .stub(DownloadRepository.prototype, 'fetchTypedPropertyRows')
        .resolves([{ submission_feature_id: 1, name: 'species', value: 'bear' }]);

      await service.writeFeatureTypeParquet(
        TEST_DOWNLOAD_ID,
        TEST_SOURCE_CART,
        TEST_ARTIFACT,
        mockProperties,
        'observation'
      );

      expect(mockWriter.appendRow).to.have.been.calledOnce;
      expect(mockWriter.close).to.have.been.calledOnce;
    });

    it('streams features to Parquet via filter path', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const mockWriter = { appendRow: sinon.stub().resolves(), close: sinon.stub().resolves() };
      sinon.stub(parquetjs.ParquetWriter, 'openStream').resolves(mockWriter as any);
      sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();

      const mockSubquery = {
        toSQL: () => ({ toNative: () => ({ sql: 'SELECT 1', bindings: [5] }) })
      } as any;
      sinon.stub(SearchFeatureService.prototype, 'buildSearchFeatureIdsSubquery').returns(mockSubquery);

      const baseBatch = [
        {
          submission_feature_id: 1,
          uuid: 'uuid-1',
          feature_type_name: 'observation',
          data: { properties: {} },
          parent_uuid: null
        }
      ];
      const streamStub = sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType')
        .returns(mockBaseCursor([baseBatch]));
      sinon
        .stub(DownloadRepository.prototype, 'fetchTypedPropertyRows')
        .resolves([{ submission_feature_id: 1, name: 'species', value: 'moose' }]);

      await service.writeFeatureTypeParquet(
        TEST_DOWNLOAD_ID,
        TEST_SOURCE_FILTER,
        TEST_ARTIFACT,
        mockProperties,
        'observation'
      );

      expect(streamStub).to.have.been.calledOnce;
      expect(streamStub.firstCall.args[0]).to.equal(TEST_DOWNLOAD_ID);
      expect(mockWriter.appendRow).to.have.been.calledOnce;
      expect(mockWriter.close).to.have.been.calledOnce;
    });

    it('uses correct S3 key format: {object_key}/{featureTypeName}/data.parquet', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const mockWriter = { appendRow: sinon.stub().resolves(), close: sinon.stub().resolves() };
      sinon.stub(parquetjs.ParquetWriter, 'openStream').resolves(mockWriter as any);
      const uploadStub = sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();

      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByCartIdAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet(
        TEST_DOWNLOAD_ID,
        TEST_SOURCE_CART,
        TEST_ARTIFACT,
        mockProperties,
        'observation'
      );

      expect(uploadStub).to.have.been.calledOnce;
      expect(uploadStub.firstCall.args[3]).to.equal(`${TEST_ARTIFACT.object_key}/observation/data.parquet`);
    });

    it('includes GeoParquet metadata when feature type has spatial properties', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const mockWriter = { appendRow: sinon.stub().resolves(), close: sinon.stub().resolves() };
      const openStreamStub = sinon.stub(parquetjs.ParquetWriter, 'openStream').resolves(mockWriter as any);
      sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByCartIdAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet(
        TEST_DOWNLOAD_ID,
        TEST_SOURCE_CART,
        TEST_ARTIFACT,
        mockSpatialProperties,
        'observation'
      );

      expect(openStreamStub).to.have.been.calledOnce;
      const writerOptions = openStreamStub.firstCall.args[2] as any;
      expect(writerOptions).to.have.property('metadata');
      expect(writerOptions.metadata).to.have.property('geo').that.is.a('string');
    });

    it('omits GeoParquet metadata when feature type has no spatial properties', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const mockWriter = { appendRow: sinon.stub().resolves(), close: sinon.stub().resolves() };
      const openStreamStub = sinon.stub(parquetjs.ParquetWriter, 'openStream').resolves(mockWriter as any);
      sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByCartIdAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet(
        TEST_DOWNLOAD_ID,
        TEST_SOURCE_CART,
        TEST_ARTIFACT,
        mockProperties,
        'observation'
      );

      expect(openStreamStub).to.have.been.calledOnce;
      const writerOptions = openStreamStub.firstCall.args[2] as any;
      expect(writerOptions).to.deep.equal({});
    });
  });

  describe('finalizeParquetDownload', () => {
    it('updates artifact status to uploaded and download status to READY', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const updateArtifactStub = sinon
        .stub(DownloadRepository.prototype, 'updateArtifactStatusByDownloadId')
        .resolves();
      const updateDownloadStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      await service.finalizeParquetDownload(TEST_DOWNLOAD_ID);

      expect(updateArtifactStub).to.have.been.calledOnce;
      expect(updateArtifactStub.firstCall.args[0]).to.equal(TEST_DOWNLOAD_ID);
      expect(updateArtifactStub.firstCall.args[1]).to.equal('uploaded');
      expect(updateDownloadStub).to.have.been.calledOnce;
      expect(updateDownloadStub.firstCall.args[1]).to.equal(DownloadStatusEnum.READY);
    });

    it('passes ISO timestamp to artifact status update', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const updateArtifactStub = sinon
        .stub(DownloadRepository.prototype, 'updateArtifactStatusByDownloadId')
        .resolves();
      sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      await service.finalizeParquetDownload(TEST_DOWNLOAD_ID);

      const timestamp = updateArtifactStub.firstCall.args[2] as string;
      // Verify it's a valid ISO timestamp
      expect(new Date(timestamp).toISOString()).to.equal(timestamp);
    });
  });
});
