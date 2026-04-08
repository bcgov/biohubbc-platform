import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { FRAGMENT_SIZE_THRESHOLD, SIGNED_URL_EXPIRY_FRAGMENT } from '../../constants/download';
import { HTTP403, HTTP404, HTTP409 } from '../../errors/http-error';
import { ArtifactStatusEnum } from '../../models/artifact';
import { DownloadRecord } from '../../models/download';
import { DownloadFragmentRecord } from '../../models/download-fragment';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadFragmentRepository } from '../../repositories/download/download-fragment-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { SearchFeatureRepository } from '../../repositories/search-feature-repository';
import * as fileUtils from '../../utils/file-utils';
import { getMockDBConnection } from '../../__mocks__/db';
import { TeamService } from '../access-policy/team-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { DownloadService } from './download-service';

chai.use(sinonChai);

describe('DownloadService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findDownloadById', () => {
    it('delegates to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const stub = sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(null);

      const result = await service.findDownloadById('aaaa0000-0000-0000-0000-000000000001');

      expect(stub).to.have.been.calledOnceWith('aaaa0000-0000-0000-0000-000000000001');
      expect(result).to.be.null;
    });
  });

  describe('getDownloadsByTeamMembership', () => {
    it('delegates to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const stub = sinon
        .stub(DownloadRepository.prototype, 'getDownloadsByTeamMembership')
        .resolves({ downloads: [], count: 0 });

      const result = await service.getDownloadsByTeamMembership(42);

      expect(stub).to.have.been.calledOnceWith(42);
      expect(result).to.deep.equal({ downloads: [], count: 0 });
    });

    it('passes through DownloadListRecord fields including create_date', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const mockRecords = [
        {
          download_id: 'aaaa0000-0000-0000-0000-000000000001',
          download_status: 'ready' as const,
          metadata: null,
          started_at: '2025-01-01T00:00:00Z',
          completed_at: '2025-01-01T00:01:00Z',
          downloaded_at: null,
          total_fragments: 1,
          completed_fragments: 1,
          estimated_total_size_bytes: '1000',
          fragment_size_bytes: '524288000',
          create_date: '2025-01-01T00:00:00Z'
        }
      ];

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadsByTeamMembership')
        .resolves({ downloads: mockRecords, count: 1 });

      const result = await service.getDownloadsByTeamMembership(42);

      expect(result.downloads).to.have.length(1);
      expect(result.downloads[0]).to.have.property('create_date', '2025-01-01T00:00:00Z');
      expect(result.count).to.equal(1);
    });
  });

  describe('markDownloadAsDownloaded', () => {
    it('delegates to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const stub = sinon.stub(DownloadRepository.prototype, 'markDownloadAsDownloaded').resolves();

      await service.markDownloadAsDownloaded('aaaa0000-0000-0000-0000-000000000001');

      expect(stub).to.have.been.calledOnceWith('aaaa0000-0000-0000-0000-000000000001');
    });
  });

  describe('createDownload', () => {
    const mockPayload = {
      cartId: 'aaaa0000-0000-0000-0000-000000000001'
    };

    it('creates download, pending artifact, and download_artifact link', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const createDownloadStub = sinon
        .stub(DownloadRepository.prototype, 'createDownload')
        .resolves({ download_id: 'dl-uuid-1' });
      sinon.stub(fileUtils, 'getObjectStoreBucketName').returns('test-bucket');
      const insertArtifactStub = sinon
        .stub(ArtifactService.prototype, 'insertArtifact')
        .resolves({ artifact_id: 'art-uuid-1' });
      const createDownloadArtifactStub = sinon
        .stub(DownloadRepository.prototype, 'createDownloadArtifact')
        .resolves();

      const result = await service.createDownload(mockPayload);

      expect(result).to.deep.equal({ download_id: 'dl-uuid-1' });
      expect(createDownloadStub).to.have.been.calledOnceWith(mockPayload);
      expect(insertArtifactStub).to.have.been.calledOnceWith({
        bucket: 'test-bucket',
        object_key: 'downloads/dl-uuid-1/download.parquet',
        byte_size: null,
        artifact_status: ArtifactStatusEnum.PENDING,
        checksum_sha256: null,
        uploaded_at: null
      });
      expect(createDownloadArtifactStub).to.have.been.calledOnceWith('dl-uuid-1', 'art-uuid-1', 'parquet');
    });

    it('propagates error when artifact insert fails', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'createDownload').resolves({ download_id: 'dl-uuid-1' });
      sinon.stub(fileUtils, 'getObjectStoreBucketName').returns('test-bucket');
      sinon.stub(ArtifactService.prototype, 'insertArtifact').rejects(new Error('Artifact insert failed'));

      try {
        await service.createDownload(mockPayload);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err.message).to.equal('Artifact insert failed');
      }
    });

    it('propagates error when createDownloadArtifact fails', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'createDownload').resolves({ download_id: 'dl-uuid-1' });
      sinon.stub(fileUtils, 'getObjectStoreBucketName').returns('test-bucket');
      sinon.stub(ArtifactService.prototype, 'insertArtifact').resolves({ artifact_id: 'art-uuid-1' });
      sinon.stub(DownloadRepository.prototype, 'createDownloadArtifact').rejects(new Error('Link failed'));

      try {
        await service.createDownload(mockPayload);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err.message).to.equal('Link failed');
      }
    });
  });

  // Helper: create a mock download record
  const createMockDownloadRecord = (overrides?: Partial<DownloadRecord>): DownloadRecord => ({
    download_id: 'aaaa0000-0000-0000-0000-000000000042',
    download_status: DownloadStatusEnum.PROCESSING,
    metadata: null,
    started_at: null,
    completed_at: null,
    downloaded_at: null,
    total_fragments: 1,
    completed_fragments: 0,
    estimated_total_size_bytes: null,
    fragment_size_bytes: String(FRAGMENT_SIZE_THRESHOLD),
    create_date: '2026-01-01T00:00:00.000Z',
    ...overrides
  });

  describe('createDownloadTeam', () => {
    it('delegates to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const stub = sinon.stub(DownloadRepository.prototype, 'createDownloadTeam').resolves();

      await service.createDownloadTeam('dl-uuid', 'team-uuid');

      expect(stub).to.have.been.calledOnceWith('dl-uuid', 'team-uuid');
    });
  });

  describe('getAuthorizedDownload', () => {
    it('returns download when anonymous (no teams)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);
      const mockDownload = createMockDownloadRecord();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(mockDownload);
      sinon.stub(DownloadRepository.prototype, 'isDownloadClaimedByTeam').resolves(false);

      const result = await service.getAuthorizedDownload('aaaa0000-0000-0000-0000-000000000042', null);

      expect(result).to.eql(mockDownload);
    });

    it('returns download when user is authorized team member', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);
      const mockDownload = createMockDownloadRecord();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(mockDownload);
      sinon.stub(DownloadRepository.prototype, 'isDownloadClaimedByTeam').resolves(true);
      sinon.stub(DownloadRepository.prototype, 'isUserAuthorizedForDownload').resolves(true);

      const result = await service.getAuthorizedDownload('aaaa0000-0000-0000-0000-000000000042', 42);

      expect(result).to.eql(mockDownload);
    });

    it('throws HTTP404 when download not found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(null);

      try {
        await service.getAuthorizedDownload('nonexistent', null);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP404);
      }
    });

    it('throws HTTP403 when unauthenticated user accesses team-based download', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(DownloadRepository.prototype, 'isDownloadClaimedByTeam').resolves(true);

      try {
        await service.getAuthorizedDownload('aaaa0000-0000-0000-0000-000000000042', null);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
      }
    });

    it('throws HTTP403 when user is not a team member', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(DownloadRepository.prototype, 'isDownloadClaimedByTeam').resolves(true);
      sinon.stub(DownloadRepository.prototype, 'isUserAuthorizedForDownload').resolves(false);

      try {
        await service.getAuthorizedDownload('aaaa0000-0000-0000-0000-000000000042', 99);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
      }
    });
  });

  describe('linkDownloadToNewTeam', () => {
    it('creates a team and links it to the download', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const createTeamStub = sinon
        .stub(TeamService.prototype, 'createTeam')
        .resolves({ team_id: 'team-1', name: 'Team for bulk dl-uuid', description: 'desc', member_count: 1 });
      const createDownloadTeamStub = sinon.stub(DownloadRepository.prototype, 'createDownloadTeam').resolves();

      await service.linkDownloadToNewTeam('dl-uuid', 42, 'Team for bulk dl-uuid', 'Team for download');

      expect(createTeamStub).to.have.been.calledOnceWith({
        name: 'Team for bulk dl-uuid',
        description: 'Team for download',
        system_user_ids: [42]
      });
      expect(createDownloadTeamStub).to.have.been.calledOnceWith('dl-uuid', 'team-1');
    });
  });

  describe('claimDownload', () => {
    it('creates team and links when download is anonymous (no teams)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(DownloadRepository.prototype, 'isDownloadClaimedByTeam').resolves(false);
      const linkStub = sinon.stub(service, 'linkDownloadToNewTeam').resolves();

      await service.claimDownload('aaaa0000-0000-0000-0000-000000000042', 42);

      expect(linkStub).to.have.been.calledOnceWith(
        'aaaa0000-0000-0000-0000-000000000042',
        42,
        'Team for cart aaaa0000-0000-0000-0000-000000000042',
        'Team created when claiming anonymous download'
      );
    });

    it('throws HTTP404 when download not found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(null);

      try {
        await service.claimDownload('nonexistent', 42);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP404);
      }
    });

    it('throws HTTP409 when download already has teams', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(DownloadRepository.prototype, 'isDownloadClaimedByTeam').resolves(true);

      try {
        await service.claimDownload('aaaa0000-0000-0000-0000-000000000042', 42);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
      }
    });
  });

  describe('getFragmentSignedUrl', () => {
    it('returns signed URL for ready fragment', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

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

      const getSignedUrlStub = sinon
        .stub(ObjectStorageService.prototype, 'getSignedUrl')
        .resolves('https://s3.example.com/fragment-url');

      const result = await service.getFragmentSignedUrl('aaaa0000-0000-0000-0000-000000000042', 0);

      expect(result).to.equal('https://s3.example.com/fragment-url');
      expect(getSignedUrlStub).to.have.been.calledOnceWith(
        BucketType.MAIN,
        'downloads/aaaa0000-0000-0000-0000-000000000042/download-aaaa0000-0000-0000-0000-000000000042-part-1.zip',
        SIGNED_URL_EXPIRY_FRAGMENT
      );
    });

    it('throws when fragment index is not found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

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
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

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
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

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

  describe('getDownloadFeatures', () => {
    it('resolves features from cart when cart_id is set', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const features = [
        { submission_feature_id: 1, submission_id: 100, feature_type_name: 'dataset', estimated_byte_size: '500' },
        { submission_feature_id: 2, submission_id: 100, feature_type_name: 'observation', estimated_byte_size: '300' }
      ];

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ cart_id: 'cart-uuid', filters: null, create_user: 1 });
      const cartStub = sinon.stub(DownloadRepository.prototype, 'getDownloadFeaturesByCartId').resolves(features);
      const searchStub = sinon.stub(DownloadRepository.prototype, 'getDownloadFeaturesBySearchQuery');

      const result = await service.getDownloadFeatures('dl-1');

      expect(result).to.have.length(2);
      expect(cartStub).to.have.been.calledOnceWith('cart-uuid');
      expect(searchStub).to.not.have.been.called;
    });

    it('resolves features from search query when filters are set', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const features = [
        { submission_feature_id: 3, submission_id: 200, feature_type_name: 'observation', estimated_byte_size: '100' }
      ];

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ cart_id: null, filters: { keyword: 'moose' }, create_user: 5 });
      const mockSubquery = {} as any;
      const buildStub = sinon
        .stub(SearchFeatureRepository.prototype, 'buildSearchFeatureIdsSubquery')
        .returns(mockSubquery);
      const searchStub = sinon
        .stub(DownloadRepository.prototype, 'getDownloadFeaturesBySearchQuery')
        .resolves(features);
      const cartStub = sinon.stub(DownloadRepository.prototype, 'getDownloadFeaturesByCartId');

      const result = await service.getDownloadFeatures('dl-1');

      expect(result).to.have.length(1);
      expect(buildStub).to.have.been.calledOnceWith({ keyword: 'moose' }, 5);
      expect(searchStub).to.have.been.calledOnceWith(mockSubquery);
      expect(cartStub).to.not.have.been.called;
    });

    it('throws when download has neither cart_id nor filters', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ cart_id: null, filters: null, create_user: 1 });

      try {
        await service.getDownloadFeatures('dl-1');
        expect.fail('Expected an error');
      } catch (error) {
        expect((error as Error).message).to.include('has neither cart_id nor filters');
      }
    });
  });
});
