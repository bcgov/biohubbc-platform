import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import {
  createMockDownloadRecord,
  createMockDownloadVersionExport,
  createMockDownloadVersionExportListRow,
  createMockExportArtifactGroup
} from '../../__mocks__/download';
import { DEFAULT_MAX_PART_SIZE_BYTES, SIGNED_URL_EXPIRY_DOWNLOAD } from '../../constants/download';
import { HTTP403, HTTP409 } from '../../errors/http-error';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadVersionExportArtifactWithFile } from '../../models/download-version-export-artifact';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { DownloadExportPart, DownloadExportService } from './download-export-service';
import { DownloadService } from './download-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';
const EXPORT_ID = 'eeee0000-0000-0000-0000-000000000001';
const VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';
const GROUP_ID = 'cccc0000-0000-0000-0000-000000000001';
const FAILED_GROUP_ID = 'cccc0000-0000-0000-0000-0000000000ff';
const SYSTEM_USER_ID = 42;

/**
 * A READY download with a materialized version — the precondition for export creation.
 */
const readyDownload = () =>
  createMockDownloadRecord({
    download_id: DOWNLOAD_ID,
    download_status: DownloadStatusEnum.READY,
    current_download_version_id: VERSION_ID
  });

describe('DownloadExportService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownloadVersionExport', () => {
    describe('resolver matrix', () => {
      it('none → creates a new group and publishes once with the group id', async () => {
        // Verifies: no active group → create + re-select + publish; the publish payload carries the
        // newly-created GROUP id (not the export id).

        // Step 1: Auth resolves a READY download with a version
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());

        // Step 2: findActive returns null first (none exists), then the created group on re-select
        const createdGroup = createMockExportArtifactGroup({
          download_version_export_artifact_group_id: GROUP_ID,
          status: DownloadStatusEnum.PENDING
        });
        const findActiveStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup')
          .onFirstCall()
          .resolves(null)
          .onSecondCall()
          .resolves(createdGroup);
        const createGroupStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createExportArtifactGroup')
          .resolves();
        const createExportStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport());
        const publishStub = sinon
          .stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob')
          .resolves('mock-job-id' as any);

        // Step 3: Create the export
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(DOWNLOAD_ID, SYSTEM_USER_ID, {}, getMockDBConnection());

        // Step 4: Verify a group was created, an export row inserted, and publish fired once with the group id
        expect(findActiveStub).to.have.been.calledTwice;
        expect(createGroupStub).to.have.been.calledOnce;
        expect(createExportStub).to.have.been.calledOnce;
        expect(publishStub).to.have.been.calledOnce;
        expect(publishStub.firstCall.args[1]).to.deep.equal({
          downloadVersionExportArtifactGroupId: GROUP_ID
        });
      });

      it('ready → attaches to the existing group, does not create a group and does not publish', async () => {
        // Verifies: a `ready` active group is reused — no createExportArtifactGroup, no publish — but
        // the per-user export row is still inserted.

        // Step 1: Auth resolves a READY download
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());

        // Step 2: findActive returns a ready group
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup')
          .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.READY }));
        const createGroupStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createExportArtifactGroup')
          .resolves();
        const createExportStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport());
        const publishStub = sinon
          .stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob')
          .resolves('mock-job-id' as any);

        // Step 3: Create the export
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(DOWNLOAD_ID, SYSTEM_USER_ID, {}, getMockDBConnection());

        // Step 4: Verify no group create, no publish, but the export row was inserted
        expect(createGroupStub).to.not.have.been.called;
        expect(publishStub).to.not.have.been.called;
        expect(createExportStub).to.have.been.calledOnce;
      });

      [DownloadStatusEnum.PENDING, DownloadStatusEnum.PROCESSING].forEach((status) => {
        it(`${status} → attaches to the in-flight group, does not create a group and does not publish`, async () => {
          // Verifies: an in-flight group (pending/processing) is reused — second identical request
          // rides the existing job rather than re-queuing.

          // Step 1: Auth resolves a READY download
          sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());

          // Step 2: findActive returns an in-flight group
          sinon
            .stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup')
            .resolves(createMockExportArtifactGroup({ status }));
          const createGroupStub = sinon
            .stub(DownloadVersionExportRepository.prototype, 'createExportArtifactGroup')
            .resolves();
          const createExportStub = sinon
            .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
            .resolves(createMockDownloadVersionExport());
          const publishStub = sinon
            .stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob')
            .resolves('mock-job-id' as any);

          // Step 3: Create the export
          const service = new DownloadExportService(getMockDBConnection());
          await service.createDownloadVersionExport(DOWNLOAD_ID, SYSTEM_USER_ID, {}, getMockDBConnection());

          // Step 4: Verify reuse — no create, no publish, export row inserted
          expect(createGroupStub).to.not.have.been.called;
          expect(publishStub).to.not.have.been.called;
          expect(createExportStub).to.have.been.calledOnce;
        });
      });

      it('failed → ends the dead group before creating a fresh one, then publishes once', async () => {
        // Verifies: a `failed` active group is ended (endExportArtifactGroup with its id) BEFORE a new
        // group is created, then publish fires once for the genuinely-new work.

        // Step 1: Auth resolves a READY download
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());

        // Step 2: findActive returns a failed group first, then the fresh group on re-select
        const failedGroup = createMockExportArtifactGroup({
          download_version_export_artifact_group_id: FAILED_GROUP_ID,
          status: DownloadStatusEnum.FAILED,
          error_message: 'boom'
        });
        const freshGroup = createMockExportArtifactGroup({
          download_version_export_artifact_group_id: GROUP_ID,
          status: DownloadStatusEnum.PENDING
        });
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup')
          .onFirstCall()
          .resolves(failedGroup)
          .onSecondCall()
          .resolves(freshGroup);
        const endGroupStub = sinon.stub(DownloadVersionExportRepository.prototype, 'endExportArtifactGroup').resolves();
        const createGroupStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createExportArtifactGroup')
          .resolves();
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport());
        const publishStub = sinon
          .stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob')
          .resolves('mock-job-id' as any);

        // Step 3: Create the export
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(DOWNLOAD_ID, SYSTEM_USER_ID, {}, getMockDBConnection());

        // Step 4: Verify the failed group was ended (by its id) BEFORE the new group create
        expect(endGroupStub).to.have.been.calledOnceWith(FAILED_GROUP_ID);
        expect(endGroupStub).to.have.been.calledBefore(createGroupStub);

        // Step 5: Verify exactly one publish for the fresh group
        expect(publishStub).to.have.been.calledOnce;
        expect(publishStub.firstCall.args[1]).to.deep.equal({
          downloadVersionExportArtifactGroupId: GROUP_ID
        });
      });

      it('feeds the re-selected group id (not the pre-create probe) into the export-row insert', async () => {
        // Verifies: the race-safe re-select path — the SECOND findActive result (the group the insert
        // converged on) supplies the artifact-group id passed to createDownloadVersionExport, not the
        // first (null) probe.

        // Step 1: Auth resolves a READY download
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());

        // Step 2: findActive returns null first, then the re-selected group
        const reselectedGroup = createMockExportArtifactGroup({
          download_version_export_artifact_group_id: GROUP_ID,
          status: DownloadStatusEnum.PENDING
        });
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup')
          .onFirstCall()
          .resolves(null)
          .onSecondCall()
          .resolves(reselectedGroup);
        sinon.stub(DownloadVersionExportRepository.prototype, 'createExportArtifactGroup').resolves();
        const createExportStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport());
        sinon
          .stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob')
          .resolves('mock-job-id' as any);

        // Step 3: Create the export
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(DOWNLOAD_ID, SYSTEM_USER_ID, {}, getMockDBConnection());

        // Step 4: Verify the insert used the re-selected group id
        expect(createExportStub.firstCall.args[0].download_version_export_artifact_group_id).to.equal(GROUP_ID);
      });
    });

    describe('export-row payload', () => {
      it('builds the insert payload with version id, hard-coded csv/per_feature_type, default part size, and group id', async () => {
        // Verifies: the service hard-codes format='csv' and mode='per_feature_type', resolves the
        // version id from the download, defaults max_part_size_bytes when the request omits it, and
        // threads the resolved group id.

        // Step 1: Auth resolves a READY download with a version
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());

        // Step 2: findActive returns a ready group (no create / no publish noise)
        sinon.stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup').resolves(
          createMockExportArtifactGroup({
            download_version_export_artifact_group_id: GROUP_ID,
            status: DownloadStatusEnum.READY
          })
        );
        const createExportStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport());

        // Step 3: Create the export with NO max_part_size_bytes in the request
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(DOWNLOAD_ID, SYSTEM_USER_ID, {}, getMockDBConnection());

        // Step 4: Verify the full insert payload
        expect(createExportStub.firstCall.args[0]).to.deep.equal({
          download_version_id: VERSION_ID,
          format: 'csv',
          mode: 'per_feature_type',
          max_part_size_bytes: DEFAULT_MAX_PART_SIZE_BYTES,
          download_version_export_artifact_group_id: GROUP_ID
        });
      });

      it('passes a request-supplied max_part_size_bytes through to the insert payload', async () => {
        // Verifies: when the request supplies max_part_size_bytes, it overrides the default in the
        // insert payload (and the group-resolution key).

        // Step 1: Auth resolves a READY download
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());

        // Step 2: findActive returns a ready group
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup')
          .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.READY }));
        const createExportStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport());

        // Step 3: Create the export WITH an explicit max_part_size_bytes
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(
          DOWNLOAD_ID,
          SYSTEM_USER_ID,
          { max_part_size_bytes: '10485760' },
          getMockDBConnection()
        );

        // Step 4: Verify the supplied value reached the insert payload
        expect(createExportStub.firstCall.args[0].max_part_size_bytes).to.equal('10485760');
      });
    });

    describe('gates', () => {
      it('throws HTTP403 when systemUserId is null and does not call getAuthorizedDownload', async () => {
        // Verifies: exports are authenticated-only — a null user short-circuits before any auth /
        // group / publish work.

        // Step 1: Stub auth so we can assert it is never reached
        const authStub = sinon.stub(DownloadService.prototype, 'getAuthorizedDownload');

        // Step 2: Call with a null systemUserId
        const service = new DownloadExportService(getMockDBConnection());
        try {
          await service.createDownloadVersionExport(DOWNLOAD_ID, null, {}, getMockDBConnection());
          expect.fail('Expected throw');
        } catch (err) {
          // Step 3: Verify HTTP403
          expect(err).to.be.instanceOf(HTTP403);
        }

        // Step 4: Verify auth was never invoked
        expect(authStub).to.not.have.been.called;
      });

      [
        DownloadStatusEnum.PENDING,
        DownloadStatusEnum.PROCESSING,
        DownloadStatusEnum.FAILED,
        DownloadStatusEnum.DOWNLOADED
      ].forEach((status) => {
        it(`throws HTTP409 when download_status is ${status}, doing no resolver or publish work`, async () => {
          // Verifies: only READY downloads can export — every non-ready parent surfaces 409 before any
          // group resolution or publish.

          // Step 1: Auth resolves a non-READY download
          sinon
            .stub(DownloadService.prototype, 'getAuthorizedDownload')
            .resolves(createMockDownloadRecord({ download_status: status, current_download_version_id: VERSION_ID }));
          const findActiveStub = sinon.stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup');
          const publishStub = sinon.stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob');

          // Step 2: Attempt to create the export
          const service = new DownloadExportService(getMockDBConnection());
          try {
            await service.createDownloadVersionExport(DOWNLOAD_ID, SYSTEM_USER_ID, {}, getMockDBConnection());
            expect.fail('Expected throw');
          } catch (err) {
            // Step 3: Verify HTTP409
            expect(err).to.be.instanceOf(HTTP409);
          }

          // Step 4: Verify no resolver / publish work happened
          expect(findActiveStub).to.not.have.been.called;
          expect(publishStub).to.not.have.been.called;
        });
      });

      it('throws HTTP409 when the download has no materialized version, doing no resolver or publish work', async () => {
        // Verifies: a READY download with a null current_download_version_id cannot export.

        // Step 1: Auth resolves a READY download with no materialized version
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(
          createMockDownloadRecord({
            download_status: DownloadStatusEnum.READY,
            current_download_version_id: null
          })
        );
        const findActiveStub = sinon.stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup');
        const publishStub = sinon.stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob');

        // Step 2: Attempt to create the export
        const service = new DownloadExportService(getMockDBConnection());
        try {
          await service.createDownloadVersionExport(DOWNLOAD_ID, SYSTEM_USER_ID, {}, getMockDBConnection());
          expect.fail('Expected throw');
        } catch (err) {
          // Step 3: Verify HTTP409
          expect(err).to.be.instanceOf(HTTP409);
        }

        // Step 4: Verify no resolver / publish work happened
        expect(findActiveStub).to.not.have.been.called;
        expect(publishStub).to.not.have.been.called;
      });
    });
  });

  describe('getAuthorizedExport', () => {
    it('authorizes the parent download before fetching the export', async () => {
      // Verifies: team-auth runs against the parent download FIRST, then the export is loaded — the
      // auth rule lives in exactly one place.

      // Step 1: Stub auth and the export fetch
      const authStub = sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
      const exportRecord = {
        ...createMockDownloadVersionExport(),
        download_id: DOWNLOAD_ID,
        status: DownloadStatusEnum.READY,
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T00:01:00.000Z',
        error_message: null
      };
      const getStub = sinon
        .stub(DownloadVersionExportRepository.prototype, 'getDownloadVersionExportById')
        .resolves(exportRecord);

      // Step 2: Authorize the export
      const service = new DownloadExportService(getMockDBConnection());
      await service.getAuthorizedExport(DOWNLOAD_ID, EXPORT_ID, SYSTEM_USER_ID);

      // Step 3: Verify auth ran against the parent download with the export id, BEFORE the fetch
      expect(authStub).to.have.been.calledOnceWith(DOWNLOAD_ID, SYSTEM_USER_ID);
      expect(getStub).to.have.been.calledOnceWith(EXPORT_ID);
      expect(authStub).to.have.been.calledBefore(getStub);
    });

    it('propagates the auth error and never fetches the export when not authorized', async () => {
      // Verifies: an auth failure short-circuits — the export is never loaded.

      // Step 1: Auth rejects with HTTP403
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));
      const getStub = sinon.stub(DownloadVersionExportRepository.prototype, 'getDownloadVersionExportById');

      // Step 2: Attempt to authorize the export
      const service = new DownloadExportService(getMockDBConnection());
      try {
        await service.getAuthorizedExport(DOWNLOAD_ID, EXPORT_ID, SYSTEM_USER_ID);
        expect.fail('Expected throw');
      } catch (err) {
        // Step 3: Verify the auth error propagates
        expect(err).to.be.instanceOf(HTTP403);
      }

      // Step 4: Verify the export was never fetched
      expect(getStub).to.not.have.been.called;
    });
  });

  describe('listAuthorizedExportsByDownloadId', () => {
    it('authorizes the parent download before listing the exports', async () => {
      // Verifies: team-auth runs against the parent download FIRST, then the list is fetched — the
      // auth rule lives in exactly one place (the service), not the route handler.

      // Step 1: Stub auth and the list fetch
      const authStub = sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
      const rows = [createMockDownloadVersionExportListRow({ download_id: DOWNLOAD_ID })];
      const listStub = sinon
        .stub(DownloadVersionExportRepository.prototype, 'listDownloadVersionExportsByDownloadId')
        .resolves(rows);

      // Step 2: List the exports
      const service = new DownloadExportService(getMockDBConnection());
      const result = await service.listAuthorizedExportsByDownloadId(DOWNLOAD_ID, SYSTEM_USER_ID);

      // Step 3: Verify auth ran against the parent download BEFORE the list, and rows pass through
      expect(authStub).to.have.been.calledOnceWith(DOWNLOAD_ID, SYSTEM_USER_ID);
      expect(listStub).to.have.been.calledOnceWith(DOWNLOAD_ID);
      expect(authStub).to.have.been.calledBefore(listStub);
      expect(result).to.eql(rows);
    });

    it('propagates the auth error and never lists when not authorized', async () => {
      // Verifies: an auth failure short-circuits — the list is never fetched.

      // Step 1: Auth rejects with HTTP403
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));
      const listStub = sinon.stub(DownloadVersionExportRepository.prototype, 'listDownloadVersionExportsByDownloadId');

      // Step 2: Attempt to list
      const service = new DownloadExportService(getMockDBConnection());
      try {
        await service.listAuthorizedExportsByDownloadId(DOWNLOAD_ID, SYSTEM_USER_ID);
        expect.fail('Expected throw');
      } catch (err) {
        // Step 3: Verify the auth error propagates
        expect(err).to.be.instanceOf(HTTP403);
      }

      // Step 4: Verify the list was never fetched
      expect(listStub).to.not.have.been.called;
    });
  });

  describe('listExportPartUrls', () => {
    it('builds one presigned URL per artifact — filename keyed by download + version id, object key from the artifact row', async () => {
      // Verifies: the saved filename is {downloadId}_{versionId}_{timestamp}_part{N}.zip (ids read
      // from the object key), getSignedUrl receives the group-keyed object_key, and chunk_id ASC order
      // is preserved.

      // Step 1: Stub the artifact list (full group-keyed object keys)
      const key1 = `downloads/${DOWNLOAD_ID}/versions/${VERSION_ID}/exports/${GROUP_ID}/biohub-${GROUP_ID}-part-1.zip`;
      const key2 = `downloads/${DOWNLOAD_ID}/versions/${VERSION_ID}/exports/${GROUP_ID}/biohub-${GROUP_ID}-part-2.zip`;
      const artifacts: DownloadVersionExportArtifactWithFile[] = [
        {
          download_version_export_artifact_id: 'ffff0000-0000-0000-0000-000000000001',
          download_version_export_artifact_group_id: GROUP_ID,
          artifact_id: 'bbbb0000-0000-0000-0000-000000000001',
          chunk_id: 1,
          byte_size: '100',
          object_key: key1
        },
        {
          download_version_export_artifact_id: 'ffff0000-0000-0000-0000-000000000002',
          download_version_export_artifact_group_id: GROUP_ID,
          artifact_id: 'bbbb0000-0000-0000-0000-000000000002',
          chunk_id: 2,
          byte_size: '200',
          object_key: key2
        }
      ];
      sinon
        .stub(DownloadVersionExportRepository.prototype, 'listExportArtifactGroupArtifactsByExportId')
        .resolves(artifacts);
      const urlStub = sinon
        .stub(ObjectStorageService.prototype, 'getSignedUrl')
        .onFirstCall()
        .resolves('https://example.com/part-1')
        .onSecondCall()
        .resolves('https://example.com/part-2');

      // Step 2: List the part URLs with a fixed started_at
      const service = new DownloadExportService(getMockDBConnection());
      const parts = await service.listExportPartUrls(EXPORT_ID, '2026-04-22T15:38:43.000Z');

      // Step 3: Verify the per-part shape, order, and renamed file_size_bytes
      expect(parts).to.deep.equal([
        { chunk_id: 1, file_size_bytes: '100', url: 'https://example.com/part-1' },
        { chunk_id: 2, file_size_bytes: '200', url: 'https://example.com/part-2' }
      ]);

      // Step 4: Verify getSignedUrl got the GROUP-keyed object_key while the disposition filename
      // names the download + version (not the export or group), with the started_at timestamp
      expect(urlStub.firstCall.args).to.deep.equal([
        BucketType.MAIN,
        key1,
        SIGNED_URL_EXPIRY_DOWNLOAD,
        `attachment; filename="${DOWNLOAD_ID}_${VERSION_ID}_20260422-153843_part1.zip"`
      ]);
      expect(urlStub.secondCall.args[3]).to.equal(
        `attachment; filename="${DOWNLOAD_ID}_${VERSION_ID}_20260422-153843_part2.zip"`
      );
    });

    it('returns [] when the export has no artifacts', async () => {
      // Verifies: empty artifact list short-circuits to an empty parts array (no getSignedUrl calls).

      // Step 1: Stub an empty artifact list
      sinon.stub(DownloadVersionExportRepository.prototype, 'listExportArtifactGroupArtifactsByExportId').resolves([]);
      const urlStub = sinon.stub(ObjectStorageService.prototype, 'getSignedUrl');

      // Step 2: List the part URLs
      const service = new DownloadExportService(getMockDBConnection());
      const parts = await service.listExportPartUrls(EXPORT_ID, '2026-04-22T15:38:43.000Z');

      // Step 3: Verify empty result and no signing work
      expect(parts).to.have.lengthOf(0);
      expect(urlStub).to.not.have.been.called;
    });

    it('falls back to a live timestamp prefix when started_at is null', async () => {
      // Verifies: a null started_at does not crash — the filename uses a now()-derived prefix.

      // Step 1: Stub a single artifact (full group-keyed object key)
      const artifacts: DownloadVersionExportArtifactWithFile[] = [
        {
          download_version_export_artifact_id: 'ffff0000-0000-0000-0000-000000000001',
          download_version_export_artifact_group_id: GROUP_ID,
          artifact_id: 'bbbb0000-0000-0000-0000-000000000001',
          chunk_id: 1,
          byte_size: '100',
          object_key: `downloads/${DOWNLOAD_ID}/versions/${VERSION_ID}/exports/${GROUP_ID}/biohub-${GROUP_ID}-part-1.zip`
        }
      ];
      sinon
        .stub(DownloadVersionExportRepository.prototype, 'listExportArtifactGroupArtifactsByExportId')
        .resolves(artifacts);
      const urlStub = sinon.stub(ObjectStorageService.prototype, 'getSignedUrl').resolves('https://example.com/part-1');

      // Step 2: List with a null started_at
      const service = new DownloadExportService(getMockDBConnection());
      await service.listExportPartUrls(EXPORT_ID, null);

      // Step 3: Verify the disposition filename shape (live timestamp — assert shape, not exact value)
      expect(urlStub.firstCall.args[3]).to.match(
        new RegExp(`^attachment; filename="${DOWNLOAD_ID}_${VERSION_ID}_\\d{8}-\\d{6}_part1\\.zip"$`)
      );
    });
  });

  describe('getAuthorizedExportWithParts', () => {
    it('populates parts via listExportPartUrls when the export is ready', async () => {
      // Verifies: a READY export composes getAuthorizedExport + listExportPartUrls, threading the
      // export's started_at into the URL assembly, and returns the record with parts attached.

      // Step 1: Stub the composed methods — auth returns a READY export, parts listing returns one part
      const exportRecord = {
        ...createMockDownloadVersionExport({ download_version_export_id: EXPORT_ID }),
        download_id: DOWNLOAD_ID,
        status: DownloadStatusEnum.READY,
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T00:01:00.000Z',
        error_message: null
      };
      const authStub = sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').resolves(exportRecord);
      const parts: DownloadExportPart[] = [{ chunk_id: 1, file_size_bytes: '100', url: 'https://example.com/part-1' }];
      const listStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls').resolves(parts);

      // Step 2: Get the detail shape
      const service = new DownloadExportService(getMockDBConnection());
      const result = await service.getAuthorizedExportWithParts(DOWNLOAD_ID, EXPORT_ID, SYSTEM_USER_ID);

      // Step 3: Verify auth threaded the params and parts were listed with the export's started_at
      expect(authStub).to.have.been.calledOnceWith(DOWNLOAD_ID, EXPORT_ID, SYSTEM_USER_ID);
      expect(listStub).to.have.been.calledOnceWith(EXPORT_ID, exportRecord.started_at);
      expect(result).to.eql({ ...exportRecord, parts });
    });

    it('returns empty parts and skips listExportPartUrls when the export is not ready', async () => {
      // Verifies: a non-ready export (pending) never assembles part URLs — parts is [].

      // Step 1: Stub auth to return a PENDING export
      const exportRecord = {
        ...createMockDownloadVersionExport({ download_version_export_id: EXPORT_ID }),
        download_id: DOWNLOAD_ID,
        status: DownloadStatusEnum.PENDING,
        started_at: null,
        completed_at: null,
        error_message: null
      };
      sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').resolves(exportRecord);
      const listStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls');

      // Step 2: Get the detail shape
      const service = new DownloadExportService(getMockDBConnection());
      const result = await service.getAuthorizedExportWithParts(DOWNLOAD_ID, EXPORT_ID, SYSTEM_USER_ID);

      // Step 3: Verify no URL assembly and an empty parts array
      expect(listStub).to.not.have.been.called;
      expect(result).to.eql({ ...exportRecord, parts: [] });
    });

    it('propagates the auth error and never lists parts when not authorized', async () => {
      // Verifies: an auth failure short-circuits — part URLs are never assembled.

      // Step 1: Auth rejects with HTTP403
      sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').rejects(new HTTP403('Access denied'));
      const listStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls');

      // Step 2: Attempt to get the detail shape
      const service = new DownloadExportService(getMockDBConnection());
      try {
        await service.getAuthorizedExportWithParts(DOWNLOAD_ID, EXPORT_ID, SYSTEM_USER_ID);
        expect.fail('Expected throw');
      } catch (err) {
        // Step 3: Verify the auth error propagated
        expect(err).to.be.instanceOf(HTTP403);
      }

      // Step 4: Verify parts were never listed
      expect(listStub).to.not.have.been.called;
    });
  });
});
