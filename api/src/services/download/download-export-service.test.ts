import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { createMockDownloadRecord } from '../../__mocks__/download';
import { SIGNED_URL_EXPIRY_DOWNLOAD } from '../../constants/download';
import { ApiNotFoundError } from '../../errors/api-error';
import { HTTP403, HTTP409 } from '../../errors/http-error';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadExportRepository } from '../../repositories/download/download-export-repository';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { DownloadExportService } from './download-export-service';
import { DownloadService } from './download-service';

chai.use(sinonChai);

const EXPORT_ID = 'dddd0000-0000-0000-0000-000000000001';
const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';
const SYSTEM_USER_ID = 42;

const mockExportRecord = {
  download_export_id: EXPORT_ID,
  download_id: DOWNLOAD_ID,
  format: 'csv',
  status: DownloadStatusEnum.PENDING,
  mode: 'per_feature_type' as const,
  max_part_size_bytes: '524288000',
  started_at: null,
  completed_at: null,
  error_message: null
};

describe('DownloadExportService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownloadExport', () => {
    it('throws HTTP403 when systemUserId is null (exports are authenticated-only)', async () => {
      const authStub = sinon.stub(DownloadService.prototype, 'getAuthorizedDownload');

      const service = new DownloadExportService(getMockDBConnection());

      try {
        await service.createDownloadExport(DOWNLOAD_ID, null, {});
        expect.fail('Expected throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP403);
      }

      expect(authStub).to.not.have.been.called;
    });

    const notReadyStatuses = [DownloadStatusEnum.PENDING, DownloadStatusEnum.PROCESSING, DownloadStatusEnum.FAILED];
    notReadyStatuses.forEach((status) => {
      it(`throws HTTP409 when download_status is ${status}`, async () => {
        sinon
          .stub(DownloadService.prototype, 'getAuthorizedDownload')
          .resolves(createMockDownloadRecord({ download_status: status }));
        sinon.stub(DownloadService.prototype, 'isDownloadClaimedByTeam').resolves(true);

        const service = new DownloadExportService(getMockDBConnection());

        try {
          await service.createDownloadExport(DOWNLOAD_ID, SYSTEM_USER_ID, {});
          expect.fail('Expected throw');
        } catch (err) {
          expect(err).to.be.instanceOf(HTTP409);
        }
      });
    });

    it('throws HTTP409 when the parent download is teamless (anonymous)', async () => {
      // An authenticated holder of an anonymous download's UUID must claim it before requesting
      // additional exports — anonymous downloads keep exactly one auto-chained default export.
      sinon
        .stub(DownloadService.prototype, 'getAuthorizedDownload')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.READY }));
      sinon.stub(DownloadService.prototype, 'isDownloadClaimedByTeam').resolves(false);
      const repoStub = sinon.stub(DownloadExportRepository.prototype, 'createDownloadExport');

      const service = new DownloadExportService(getMockDBConnection());

      try {
        await service.createDownloadExport(DOWNLOAD_ID, SYSTEM_USER_ID, {});
        expect.fail('Expected throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP409);
      }

      expect(repoStub).to.not.have.been.called;
    });

    it('applies default max_part_size_bytes "524288000" when the request omits it', async () => {
      sinon
        .stub(DownloadService.prototype, 'getAuthorizedDownload')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.READY }));
      sinon.stub(DownloadService.prototype, 'isDownloadClaimedByTeam').resolves(true);
      const repoStub = sinon
        .stub(DownloadExportRepository.prototype, 'createDownloadExport')
        .resolves(mockExportRecord);

      const service = new DownloadExportService(getMockDBConnection());
      await service.createDownloadExport(DOWNLOAD_ID, SYSTEM_USER_ID, {});

      expect(repoStub.firstCall.args[0].max_part_size_bytes).to.equal('524288000');
    });

    it('forwards a user-supplied max_part_size_bytes verbatim', async () => {
      sinon
        .stub(DownloadService.prototype, 'getAuthorizedDownload')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.READY }));
      sinon.stub(DownloadService.prototype, 'isDownloadClaimedByTeam').resolves(true);
      const repoStub = sinon
        .stub(DownloadExportRepository.prototype, 'createDownloadExport')
        .resolves(mockExportRecord);

      const service = new DownloadExportService(getMockDBConnection());
      await service.createDownloadExport(DOWNLOAD_ID, SYSTEM_USER_ID, { max_part_size_bytes: '10485760' });

      expect(repoStub.firstCall.args[0].max_part_size_bytes).to.equal('10485760');
    });

    it('hard-codes format "csv" and mode "per_feature_type"; forwards download_id', async () => {
      sinon
        .stub(DownloadService.prototype, 'getAuthorizedDownload')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.READY }));
      sinon.stub(DownloadService.prototype, 'isDownloadClaimedByTeam').resolves(true);
      const repoStub = sinon
        .stub(DownloadExportRepository.prototype, 'createDownloadExport')
        .resolves(mockExportRecord);

      const service = new DownloadExportService(getMockDBConnection());
      await service.createDownloadExport(DOWNLOAD_ID, SYSTEM_USER_ID, {});

      expect(repoStub.firstCall.args[0].format).to.equal('csv');
      expect(repoStub.firstCall.args[0].mode).to.equal('per_feature_type');
      expect(repoStub.firstCall.args[0].download_id).to.equal(DOWNLOAD_ID);
    });

    it('delegates team-membership auth to DownloadService.getAuthorizedDownload', async () => {
      const authStub = sinon
        .stub(DownloadService.prototype, 'getAuthorizedDownload')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.READY }));
      sinon.stub(DownloadService.prototype, 'isDownloadClaimedByTeam').resolves(true);
      sinon.stub(DownloadExportRepository.prototype, 'createDownloadExport').resolves(mockExportRecord);

      const service = new DownloadExportService(getMockDBConnection());
      await service.createDownloadExport(DOWNLOAD_ID, SYSTEM_USER_ID, {});

      expect(authStub).to.have.been.calledOnceWith(DOWNLOAD_ID, SYSTEM_USER_ID);
    });
  });

  describe('getAuthorizedExport', () => {
    it('propagates HTTP403 from getAuthorizedDownload for an anonymous user on a team-scoped parent', async () => {
      // Verifies: export access mirrors download access — a null user on a team-scoped parent is
      // rejected by getAuthorizedDownload, and getAuthorizedExport delegates to it (no longer
      // short-circuits on null).

      // Step 1: Stub the export fetch to return a record, and the download auth to reject
      sinon.stub(DownloadExportRepository.prototype, 'getDownloadExportById').resolves(mockExportRecord);
      const authStub = sinon
        .stub(DownloadService.prototype, 'getAuthorizedDownload')
        .rejects(new HTTP403('Access denied'));

      const service = new DownloadExportService(getMockDBConnection());

      // Step 2: Call with no security identity
      try {
        await service.getAuthorizedExport(EXPORT_ID, null);
        expect.fail('Expected throw');
      } catch (err) {
        // Step 3: The HTTP403 from the download auth propagates unchanged
        expect(err).to.be.instanceOf(HTTP403);
      }

      // Step 4: The team-auth check WAS delegated (with the parent download id and the null user)
      expect(authStub).to.have.been.calledOnceWith(DOWNLOAD_ID, null);
    });

    it('returns the export record for an anonymous user on a teamless parent', async () => {
      // Verifies: a teamless (anonymous) parent is reachable by UUID alone — getAuthorizedDownload
      // resolves for a null user, so the export record is returned.

      // Step 1: Stub the export fetch and a resolving download auth
      sinon.stub(DownloadExportRepository.prototype, 'getDownloadExportById').resolves(mockExportRecord);
      const authStub = sinon
        .stub(DownloadService.prototype, 'getAuthorizedDownload')
        .resolves(createMockDownloadRecord({ download_id: DOWNLOAD_ID }));

      const service = new DownloadExportService(getMockDBConnection());

      // Step 2: Call with no security identity
      const result = await service.getAuthorizedExport(EXPORT_ID, null);

      // Step 3: The team-auth check was delegated with the null user
      expect(authStub).to.have.been.calledOnceWith(DOWNLOAD_ID, null);

      // Step 4: The fetched export record is returned
      expect(result).to.equal(mockExportRecord);
    });

    it('delegates to DownloadService.getAuthorizedDownload with the export record download_id', async () => {
      // Verifies: the parent download id pulled from the export record drives the team-auth check.

      // Step 1: Stub the export fetch and a resolving download auth
      sinon.stub(DownloadExportRepository.prototype, 'getDownloadExportById').resolves(mockExportRecord);
      const authStub = sinon
        .stub(DownloadService.prototype, 'getAuthorizedDownload')
        .resolves(createMockDownloadRecord({ download_id: DOWNLOAD_ID }));

      const service = new DownloadExportService(getMockDBConnection());

      // Step 2: Call as an authenticated user
      const result = await service.getAuthorizedExport(EXPORT_ID, 42);

      // Step 3: Auth was delegated with the parent id and the user, and the export record is returned
      expect(authStub).to.have.been.calledOnceWith(DOWNLOAD_ID, 42);
      expect(result).to.equal(mockExportRecord);
    });

    it('propagates ApiNotFoundError and skips the team-auth check when the export is missing', async () => {
      // Verifies: a missing export surfaces ApiNotFoundError from the fetch before any team-auth
      // check runs — getAuthorizedDownload must not be called for a non-existent export.

      // Step 1: Stub the export fetch to reject as missing
      sinon
        .stub(DownloadExportRepository.prototype, 'getDownloadExportById')
        .rejects(new ApiNotFoundError('Download export not found'));
      const authStub = sinon.stub(DownloadService.prototype, 'getAuthorizedDownload');

      const service = new DownloadExportService(getMockDBConnection());

      // Step 2: Call for a missing export
      try {
        await service.getAuthorizedExport(EXPORT_ID, 42);
        expect.fail('Expected throw');
      } catch (err) {
        // Step 3: The not-found error propagates
        expect(err).to.be.instanceOf(ApiNotFoundError);
      }

      // Step 4: The team-auth check is never reached
      expect(authStub).to.not.have.been.called;
    });
  });

  describe('listExportPartUrls', () => {
    it('returns [] when the export has no artifacts', async () => {
      sinon.stub(DownloadExportRepository.prototype, 'listDownloadExportArtifactsByExportId').resolves([]);
      sinon.stub(ObjectStorageService.prototype, 'getSignedUrl');

      const service = new DownloadExportService(getMockDBConnection());
      const parts = await service.listExportPartUrls(EXPORT_ID, '2026-04-22T15:38:43.000Z');

      expect(parts).to.have.lengthOf(0);
    });

    it('builds one presigned URL per artifact with a sortable timestamp-prefixed filename, preserving chunk_id ASC order', async () => {
      sinon.stub(DownloadExportRepository.prototype, 'listDownloadExportArtifactsByExportId').resolves([
        {
          download_export_artifact_id: 1,
          download_export_id: EXPORT_ID,
          artifact_id: 'bbbb0000-0000-0000-0000-000000000001',
          chunk_id: 1,
          byte_size: '100',
          object_key: 'downloads/d/exports/e/biohub-e-part-1.zip'
        },
        {
          download_export_artifact_id: 2,
          download_export_id: EXPORT_ID,
          artifact_id: 'bbbb0000-0000-0000-0000-000000000002',
          chunk_id: 2,
          byte_size: '200',
          object_key: 'downloads/d/exports/e/biohub-e-part-2.zip'
        }
      ]);
      const urlStub = sinon
        .stub(ObjectStorageService.prototype, 'getSignedUrl')
        .onFirstCall()
        .resolves('https://example.com/part-1')
        .onSecondCall()
        .resolves('https://example.com/part-2');

      const service = new DownloadExportService(getMockDBConnection());
      const parts = await service.listExportPartUrls(EXPORT_ID, '2026-04-22T15:38:43.000Z');

      expect(parts).to.deep.equal([
        { chunk_id: 1, file_size_bytes: '100', url: 'https://example.com/part-1' },
        { chunk_id: 2, file_size_bytes: '200', url: 'https://example.com/part-2' }
      ]);
      expect(urlStub.firstCall.args).to.deep.equal([
        BucketType.MAIN,
        'downloads/d/exports/e/biohub-e-part-1.zip',
        SIGNED_URL_EXPIRY_DOWNLOAD,
        `attachment; filename="20260422-153843-biohub-${EXPORT_ID}-part-1.zip"`
      ]);
      expect(urlStub.secondCall.args[3]).to.equal(
        `attachment; filename="20260422-153843-biohub-${EXPORT_ID}-part-2.zip"`
      );
    });

    it('falls back to now() when started_at is null', async () => {
      sinon.stub(DownloadExportRepository.prototype, 'listDownloadExportArtifactsByExportId').resolves([
        {
          download_export_artifact_id: 1,
          download_export_id: EXPORT_ID,
          artifact_id: 'bbbb0000-0000-0000-0000-000000000001',
          chunk_id: 1,
          byte_size: '100',
          object_key: 'downloads/d/exports/e/biohub-e-part-1.zip'
        }
      ]);
      const urlStub = sinon.stub(ObjectStorageService.prototype, 'getSignedUrl').resolves('https://example.com/part-1');

      const service = new DownloadExportService(getMockDBConnection());
      await service.listExportPartUrls(EXPORT_ID, null);

      // Disposition is built with a live timestamp — just assert shape, not exact value.
      expect(urlStub.firstCall.args[3]).to.match(
        new RegExp(`^attachment; filename="\\d{8}-\\d{6}-biohub-${EXPORT_ID}-part-1\\.zip"$`)
      );
    });
  });
});
