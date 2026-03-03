import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { FRAGMENT_SIZE_THRESHOLD, SIGNED_URL_EXPIRY_FRAGMENT } from '../../constants/download';
import { ApiConflictError } from '../../errors/api-error';
import {
  DownloadFeatureData,
  DownloadFeatureSummary,
  DownloadId,
  DownloadRecord,
  DownloadSizeEstimate
} from '../../models/download';
import { DownloadFragmentId, DownloadFragmentRecord } from '../../models/download-fragment';
import { DownloadStatusEnum } from '../../models/download-status';
import { FeatureTypeWithFeaturePropertiesCode } from '../../repositories/code-repository';
import { DownloadFragmentRepository } from '../../repositories/download/download-fragment-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { CodeService } from '../code-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { DownloadPipelineService } from './download-pipeline-service';

chai.use(sinonChai);

describe('DownloadPipelineService', () => {
  afterEach(() => {
    sinon.restore();
  });

  // Helper: create a mock download record
  const createMockDownloadRecord = (overrides?: Partial<DownloadRecord>): DownloadRecord => ({
    download_id: 'aaaa0000-0000-0000-0000-000000000042',
    system_user_id: null,
    team_id: null,
    data_request_id: null,
    download_status: DownloadStatusEnum.PROCESSING,
    metadata: null,
    started_at: null,
    completed_at: null,
    downloaded_at: null,
    total_fragments: 1,
    completed_fragments: 0,
    estimated_total_size_bytes: null,
    fragment_size_bytes: String(FRAGMENT_SIZE_THRESHOLD),
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

  describe('createDownloadRequest', () => {
    it('passes systemUserId to createDownload for authenticated users', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => 42
      });
      const service = new DownloadPipelineService(mockDBConnection);

      const createDownloadStub = sinon
        .stub(DownloadRepository.prototype, 'createDownload')
        .resolves({ download_id: 'aaaa0000-0000-0000-0000-000000000001' } satisfies DownloadId);
      sinon.stub(DownloadRepository.prototype, 'createDownloadFeatures').resolves();

      await service.createDownloadRequest(null, [10, 20]);

      expect(createDownloadStub).to.have.been.calledOnce;
      // systemUserId (42) should be passed as the 4th argument
      expect(createDownloadStub.firstCall.args[3]).to.equal(42);
    });

    it('passes null systemUserId for anonymous downloads', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => null as unknown as number
      });
      const service = new DownloadPipelineService(mockDBConnection);

      const createDownloadStub = sinon
        .stub(DownloadRepository.prototype, 'createDownload')
        .resolves({ download_id: 'aaaa0000-0000-0000-0000-000000000001' } satisfies DownloadId);
      sinon.stub(DownloadRepository.prototype, 'createDownloadFeatures').resolves();

      await service.createDownloadRequest(null, [10, 20]);

      expect(createDownloadStub).to.have.been.calledOnce;
      expect(createDownloadStub.firstCall.args[3]).to.be.null;
    });

    it('passes searchFilters to createDownload as 5th arg', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => 42
      });
      const service = new DownloadPipelineService(mockDBConnection);

      const createDownloadStub = sinon
        .stub(DownloadRepository.prototype, 'createDownload')
        .resolves({ download_id: 'aaaa0000-0000-0000-0000-000000000001' } satisfies DownloadId);
      sinon.stub(DownloadRepository.prototype, 'createDownloadFeatures').resolves();

      const filters = { keyword: 'elk' };
      await service.createDownloadRequest(null, [10, 20], undefined, undefined, filters);

      expect(createDownloadStub).to.have.been.calledOnce;
      // systemUserId still in correct position (4th arg)
      expect(createDownloadStub.firstCall.args[3]).to.equal(42);
      // searchFilters forwarded as 5th arg
      expect(createDownloadStub.firstCall.args[4]).to.deep.equal({ keyword: 'elk' });
    });

    it('omitting searchFilters passes undefined as 5th arg', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => 42
      });
      const service = new DownloadPipelineService(mockDBConnection);

      const createDownloadStub = sinon
        .stub(DownloadRepository.prototype, 'createDownload')
        .resolves({ download_id: 'aaaa0000-0000-0000-0000-000000000001' } satisfies DownloadId);
      sinon.stub(DownloadRepository.prototype, 'createDownloadFeatures').resolves();

      await service.createDownloadRequest(null, [10, 20]);

      expect(createDownloadStub).to.have.been.calledOnce;
      expect(createDownloadStub.firstCall.args[4]).to.be.undefined;
    });

    it('still creates download features after searchFilters signature change', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => 42
      });
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadRepository.prototype, 'createDownload')
        .resolves({ download_id: 'aaaa0000-0000-0000-0000-000000000001' } satisfies DownloadId);
      const createFeaturesStub = sinon.stub(DownloadRepository.prototype, 'createDownloadFeatures').resolves();

      await service.createDownloadRequest(null, [10, 20], undefined, undefined, { keyword: 'elk' });

      expect(createFeaturesStub).to.have.been.calledOnce;
      expect(createFeaturesStub.firstCall.args[0]).to.equal('aaaa0000-0000-0000-0000-000000000001');
      expect(createFeaturesStub.firstCall.args[1]).to.deep.equal([10, 20]);
    });
  });

  describe('claimDownload', () => {
    it('calls repository claimDownload with correct params', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => 42
      });
      const service = new DownloadPipelineService(mockDBConnection);

      const claimStub = sinon.stub(DownloadRepository.prototype, 'claimDownload').resolves(true);

      await service.claimDownload('aaaa0000-0000-0000-0000-000000000001');

      expect(claimStub).to.have.been.calledOnceWith('aaaa0000-0000-0000-0000-000000000001', 42);
    });

    it('throws ApiConflictError when claim fails', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => 42
      });
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'claimDownload').resolves(false);

      try {
        await service.claimDownload('aaaa0000-0000-0000-0000-000000000001');
        expect.fail('Expected an error');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }
    });
  });

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
      const mockEstimate: DownloadSizeEstimate = { totalEstimatedBytes: 1000, features: [] };
      const estimateStub = sinon.stub(service, 'estimateDownloadSize').resolves(mockEstimate);
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
      const mockCodes: FeatureTypeWithFeaturePropertiesCode[] = [
        {
          feature_type: { feature_type_id: 1, feature_type_name: 'file', feature_type_display_name: 'File' },
          feature_type_properties: [
            {
              feature_property_id: 1,
              feature_property_name: 'artifact_key',
              feature_property_display_name: 'Artifact Key',
              feature_property_type_id: 1,
              feature_property_type_name: 'artifact_key'
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
      // Verifies: S3 key uses download-{id}-part-{n+1}.zip when total_fragments > 1

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
      const mockCodes: FeatureTypeWithFeaturePropertiesCode[] = [
        {
          feature_type: {
            feature_type_id: 2,
            feature_type_name: 'observation',
            feature_type_display_name: 'Observation'
          },
          feature_type_properties: [
            {
              feature_property_id: 1,
              feature_property_name: 'species',
              feature_property_display_name: 'Species',
              feature_property_type_id: 1,
              feature_property_type_name: 'string'
            }
          ]
        }
      ];
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
      const uploadStreamStub = sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();

      await service.processFragment(pendingFragment, 'aaaa0000-0000-0000-0000-000000000042');

      expect(uploadStreamStub.calledOnce).to.be.true;
      expect(uploadStreamStub.firstCall.args[3]).to.equal(
        'downloads/aaaa0000-0000-0000-0000-000000000042/download-aaaa0000-0000-0000-0000-000000000042-part-2.zip'
      );
    });
  });

  describe('finalizeDownload', () => {
    it('sets READY status for single-fragment download', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const readyFragment = createMockFragment({
        fragment_status: DownloadStatusEnum.READY,
        s3_key: 'downloads/aaaa0000-0000-0000-0000-000000000042/download-aaaa0000-0000-0000-0000-000000000042.zip',
        file_name: 'download-aaaa0000-0000-0000-0000-000000000042.zip',
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
    it('sums per-feature sizes for totalEstimatedBytes', async () => {
      // Verifies: totalEstimatedBytes is the sum of per-feature estimated_byte_size

      // Step 1: Setup service with mock connection
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      // Step 2: Stub per-feature query
      const features: DownloadFeatureSummary[] = [
        { submission_feature_id: 1, feature_type_name: 'observation', estimated_byte_size: '120', submission_id: 1 },
        { submission_feature_id: 2, feature_type_name: 'sample', estimated_byte_size: '80', submission_id: 1 }
      ];
      sinon.stub(DownloadRepository.prototype, 'getDownloadFeatureSummaries').resolves(features);

      // Step 3: Call estimateDownloadSize
      const result = await service.estimateDownloadSize('aaaa0000-0000-0000-0000-000000000001', null);

      // Step 4: Verify total is sum of per-feature sizes
      expect(result.totalEstimatedBytes).to.equal(200);
      expect(result.features).to.have.length(2);
      expect(result.features[0].estimated_byte_size).to.equal('120');
      expect(result.features[1].estimated_byte_size).to.equal('80');
    });

    it('returns zero total for empty downloads', async () => {
      // Verifies: No features → totalEstimatedBytes defaults to 0

      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'getDownloadFeatureSummaries').resolves([]);

      const result = await service.estimateDownloadSize('aaaa0000-0000-0000-0000-000000000001', null);

      expect(result.totalEstimatedBytes).to.equal(0);
      expect(result.features).to.have.length(0);
    });
  });

  describe('planFragments', () => {
    it('creates multiple fragments when exceeding threshold', async () => {
      // Verifies: Bin packing splits features across fragments based on fragment_size_bytes

      // Step 1: Setup service with mock connection
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      // Step 2: Create 3 features — two fit in one bin, third needs a new bin
      const features: DownloadFeatureSummary[] = [
        {
          submission_feature_id: 10,
          feature_type_name: 'observation',
          estimated_byte_size: '100',
          submission_id: 1
        },
        {
          submission_feature_id: 20,
          feature_type_name: 'observation',
          estimated_byte_size: '100',
          submission_id: 1
        },
        {
          submission_feature_id: 30,
          feature_type_name: 'observation',
          estimated_byte_size: '100',
          submission_id: 1
        }
      ];
      // Step 3: Stub fragment repository methods
      const createFragmentStub = sinon.stub(DownloadFragmentRepository.prototype, 'createDownloadFragment');
      createFragmentStub.onFirstCall().resolves({ download_fragment_id: 1 } satisfies DownloadFragmentId);
      createFragmentStub.onSecondCall().resolves({ download_fragment_id: 2 } satisfies DownloadFragmentId);
      const createFragmentFeaturesStub = sinon
        .stub(DownloadFragmentRepository.prototype, 'createDownloadFragmentFeatures')
        .resolves();
      const updateFragmentCountsStub = sinon
        .stub(DownloadRepository.prototype, 'updateDownloadFragmentCounts')
        .resolves();
      sinon.stub(DownloadRepository.prototype, 'updateEstimatedTotalSize').resolves();

      // Stub findDownloadById to return record with default fragment_size_bytes
      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(
        createMockDownloadRecord({
          download_id: 'aaaa0000-0000-0000-0000-000000000001',
          fragment_size_bytes: String(FRAGMENT_SIZE_THRESHOLD)
        })
      );

      // Step 4: Call planFragments with bin packing
      // Feature 10 = 120MB, Feature 20 = 120MB (total 240MB > 200MB threshold), Feature 30 = 80MB
      const oneHundredTwentyMB = 120 * 1024 * 1024;
      const eightyMB = 80 * 1024 * 1024;
      // Override estimated_byte_size on features for bin packing test
      features[0].estimated_byte_size = String(oneHundredTwentyMB);
      features[1].estimated_byte_size = String(oneHundredTwentyMB);
      features[2].estimated_byte_size = String(eightyMB);
      const sizeEstimate: DownloadSizeEstimate = {
        totalEstimatedBytes: oneHundredTwentyMB * 2 + eightyMB,
        features
      };
      await service.planFragments('aaaa0000-0000-0000-0000-000000000001', sizeEstimate);

      // Step 5: Verify 2 fragments created — first has feature 10, then flush when 10+20 > threshold
      // Fragment 0: feature 10 (120MB) — flush when adding 20 would exceed 200MB
      // Fragment 1: features 20+30 (120+80=200MB)
      expect(createFragmentStub).to.have.been.calledTwice;
      expect(createFragmentStub.firstCall.args[1]).to.equal(0); // fragment_index 0
      expect(createFragmentStub.secondCall.args[1]).to.equal(1); // fragment_index 1
      expect(createFragmentFeaturesStub.firstCall.args[1]).to.deep.equal([10]); // first bin: feature 10
      expect(createFragmentFeaturesStub.secondCall.args[1]).to.deep.equal([20, 30]); // second bin: features 20, 30
      expect(updateFragmentCountsStub).to.have.been.calledOnceWith('aaaa0000-0000-0000-0000-000000000001', 2);
    });

    it('uses custom fragment size from download record instead of default threshold', async () => {
      // Verifies: Bin packing reads fragment_size_bytes from the download record, not the hardcoded constant

      // Step 1: Setup service with mock connection
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      // Step 2: Create 3 features — with 1 GB threshold, all 3 fit in one fragment
      const features: DownloadFeatureSummary[] = [
        {
          submission_feature_id: 10,
          feature_type_name: 'observation',
          estimated_byte_size: '100',
          submission_id: 1
        },
        {
          submission_feature_id: 20,
          feature_type_name: 'observation',
          estimated_byte_size: '100',
          submission_id: 1
        },
        {
          submission_feature_id: 30,
          feature_type_name: 'observation',
          estimated_byte_size: '100',
          submission_id: 1
        }
      ];
      // Step 3: Stub findDownloadById with custom 1 GB fragment size
      const oneGB = 1000 * 1024 * 1024;
      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(
        createMockDownloadRecord({
          download_id: 'aaaa0000-0000-0000-0000-000000000001',
          fragment_size_bytes: String(oneGB)
        })
      );

      // Step 4: Stub fragment repository methods
      const createFragmentStub = sinon.stub(DownloadFragmentRepository.prototype, 'createDownloadFragment');
      createFragmentStub.onFirstCall().resolves({ download_fragment_id: 1 } satisfies DownloadFragmentId);
      const createFragmentFeaturesStub = sinon
        .stub(DownloadFragmentRepository.prototype, 'createDownloadFragmentFeatures')
        .resolves();
      const updateFragmentCountsStub = sinon
        .stub(DownloadRepository.prototype, 'updateDownloadFragmentCounts')
        .resolves();
      sinon.stub(DownloadRepository.prototype, 'updateEstimatedTotalSize').resolves();

      // Step 5: Call planFragments — same features as previous test (300+300+200=800MB)
      // With default 500MB threshold, this would create 2 fragments
      // With custom 1GB threshold, all features fit in 1 fragment
      const threeHundredMB = 300 * 1024 * 1024;
      const twoHundredMB = 200 * 1024 * 1024;
      features[0].estimated_byte_size = String(threeHundredMB);
      features[1].estimated_byte_size = String(threeHundredMB);
      features[2].estimated_byte_size = String(twoHundredMB);
      const sizeEstimate: DownloadSizeEstimate = {
        totalEstimatedBytes: threeHundredMB * 2 + twoHundredMB,
        features
      };
      await service.planFragments('aaaa0000-0000-0000-0000-000000000001', sizeEstimate);

      // Step 6: Verify only 1 fragment created — all features fit within 1 GB threshold
      expect(createFragmentStub).to.have.been.calledOnce;
      expect(createFragmentFeaturesStub.firstCall.args[1]).to.deep.equal([10, 20, 30]); // all features in one bin
      expect(updateFragmentCountsStub).to.have.been.calledOnceWith('aaaa0000-0000-0000-0000-000000000001', 1);
    });
  });

  describe('getFragmentSignedUrl', () => {
    it('returns signed URL for ready fragment', async () => {
      // Verifies: Happy path - correct s3_key and expiry passed to getSignedUrl

      // Step 1: Setup service with mock connection
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      // Step 2: Stub to return a READY fragment with s3_key
      const readyFragment: DownloadFragmentRecord = {
        download_fragment_id: 1,
        download_id: 'aaaa0000-0000-0000-0000-000000000042',
        fragment_index: 0,
        fragment_status: DownloadStatusEnum.READY,
        s3_key:
          'downloads/aaaa0000-0000-0000-0000-000000000042/download-aaaa0000-0000-0000-0000-000000000042-part-1.zip',
        file_name: 'download-aaaa0000-0000-0000-0000-000000000042-part-1.zip',
        file_size_bytes: '2048',
        estimated_size_bytes: '2000',
        feature_count: 3,
        started_at: '2024-01-01T00:00:00Z',
        completed_at: '2024-01-01T00:01:00Z',
        error_message: null
      };
      sinon.stub(DownloadFragmentRepository.prototype, 'getFragmentsByDownloadId').resolves([readyFragment]);

      // Step 3: Stub ObjectStorageService.getSignedUrl
      const getSignedUrlStub = sinon
        .stub(ObjectStorageService.prototype, 'getSignedUrl')
        .resolves('https://s3.example.com/fragment-url');

      // Step 4: Call getFragmentSignedUrl
      const result = await service.getFragmentSignedUrl('aaaa0000-0000-0000-0000-000000000042', 0);

      // Step 5: Verify correct URL returned and correct params passed (including fragment expiry)
      expect(result).to.equal('https://s3.example.com/fragment-url');
      expect(getSignedUrlStub).to.have.been.calledOnceWith(
        BucketType.MAIN,
        'downloads/aaaa0000-0000-0000-0000-000000000042/download-aaaa0000-0000-0000-0000-000000000042-part-1.zip',
        SIGNED_URL_EXPIRY_FRAGMENT
      );
    });

    it('throws when fragment index is not found', async () => {
      // Verifies: Error thrown when requested fragment_index doesn't exist

      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(DownloadFragmentRepository.prototype, 'getFragmentsByDownloadId').resolves([]);

      try {
        await service.getFragmentSignedUrl('aaaa0000-0000-0000-0000-000000000042', 0);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal(
          'Fragment 0 not found for download aaaa0000-0000-0000-0000-000000000042'
        );
      }
    });

    it('throws when fragment is not ready', async () => {
      // Verifies: Error thrown when fragment exists but status is not READY

      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const processingFragment: DownloadFragmentRecord = {
        download_fragment_id: 1,
        download_id: 'aaaa0000-0000-0000-0000-000000000042',
        fragment_index: 0,
        fragment_status: DownloadStatusEnum.PROCESSING,
        s3_key: null,
        file_name: null,
        file_size_bytes: null,
        estimated_size_bytes: '2000',
        feature_count: 3,
        started_at: '2024-01-01T00:00:00Z',
        completed_at: null,
        error_message: null
      };
      sinon.stub(DownloadFragmentRepository.prototype, 'getFragmentsByDownloadId').resolves([processingFragment]);

      try {
        await service.getFragmentSignedUrl('aaaa0000-0000-0000-0000-000000000042', 0);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('Fragment is not ready');
      }
    });

    it('throws when fragment is ready but missing s3_key', async () => {
      // Verifies: Error thrown when fragment is READY but s3_key is null (data integrity issue)

      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const readyButNoKey: DownloadFragmentRecord = {
        download_fragment_id: 1,
        download_id: 'aaaa0000-0000-0000-0000-000000000042',
        fragment_index: 0,
        fragment_status: DownloadStatusEnum.READY,
        s3_key: null,
        file_name: 'download-aaaa0000-0000-0000-0000-000000000042.zip',
        file_size_bytes: '2048',
        estimated_size_bytes: '2000',
        feature_count: 3,
        started_at: '2024-01-01T00:00:00Z',
        completed_at: '2024-01-01T00:01:00Z',
        error_message: null
      };
      sinon.stub(DownloadFragmentRepository.prototype, 'getFragmentsByDownloadId').resolves([readyButNoKey]);

      try {
        await service.getFragmentSignedUrl('aaaa0000-0000-0000-0000-000000000042', 0);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('Fragment record missing s3_key');
      }
    });
  });
});
