import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { PassThrough } from 'node:stream';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { createMockExportArtifactGroup } from '../../__mocks__/download';
import { ApiConflictError } from '../../errors/api-error';
import { DownloadStatusEnum } from '../../models/download-status';
import { FEATURE_PROPERTY_TYPE } from '../../models/feature-property';
import { FeatureTypeWithProperties } from '../../models/feature-type';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
import { CodeService } from '../code-service';
import { ArtifactService } from '../upload/artifact-service';
import { DownloadExportPipelineService } from './download-export-pipeline-service';

chai.use(sinonChai);

const GROUP_ID = 'cccc0000-0000-0000-0000-000000000001';
const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000042';
const DOWNLOAD_VERSION_ID = 'dddd0000-0000-0000-0000-000000000099';

describe('DownloadExportPipelineService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('transitionGroupStatus', () => {
    it('throws ApiConflictError when current status is not in allowedCurrentStatuses (illegal transition)', async () => {
      // Verifies: an illegal transition (ready → ready, ready not allowed) throws and never writes.

      // Step 1: Stub the group fetch to return a READY group (the disallowed current status)
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionExportRepository.prototype, 'getExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.READY }));
      const updateStub = sinon
        .stub(DownloadVersionExportRepository.prototype, 'updateExportArtifactGroupStatus')
        .resolves();

      // Step 2: Attempt the illegal transition
      try {
        await service.transitionGroupStatus(GROUP_ID, DownloadStatusEnum.READY, [DownloadStatusEnum.PROCESSING]);
        expect.fail('expected throw');
      } catch (err: any) {
        // Step 3: Verify the conflict error surfaced
        expect(err).to.be.instanceOf(ApiConflictError);
        expect(err.message).to.equal('Invalid download export status transition');
      }

      // Step 4: No write happened — the assertion fired before the update call
      expect(updateStub.called).to.be.false;
    });

    it('throws ApiConflictError on failed → processing (terminal status cannot restart)', async () => {
      // Verifies: a terminal FAILED group cannot be transitioned to PROCESSING — an illegal restart
      // is rejected and no update is written.

      // Step 1: Stub the group fetch to return a FAILED (terminal) group
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionExportRepository.prototype, 'getExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.FAILED }));
      const updateStub = sinon
        .stub(DownloadVersionExportRepository.prototype, 'updateExportArtifactGroupStatus')
        .resolves();

      // Step 2: Attempt the illegal failed → processing transition (only PENDING/PROCESSING allowed)
      try {
        await service.transitionGroupStatus(GROUP_ID, DownloadStatusEnum.PROCESSING, [
          DownloadStatusEnum.PENDING,
          DownloadStatusEnum.PROCESSING
        ]);
        expect.fail('expected throw');
      } catch (err: any) {
        // Step 3: Verify the conflict error surfaced
        expect(err).to.be.instanceOf(ApiConflictError);
        expect(err.message).to.equal('Invalid download export status transition');
      }

      // Step 4: No write happened
      expect(updateStub.called).to.be.false;
    });

    it('sets started_at in repo call on pending→processing transition', async () => {
      // Verifies: a pending→processing transition stamps started_at (not completed_at) on the update.

      // Step 1: Stub the group fetch to return a PENDING group
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionExportRepository.prototype, 'getExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.PENDING }));
      const updateStub = sinon
        .stub(DownloadVersionExportRepository.prototype, 'updateExportArtifactGroupStatus')
        .resolves();

      // Step 2: Perform the transition
      await service.transitionGroupStatus(GROUP_ID, DownloadStatusEnum.PROCESSING, [DownloadStatusEnum.PENDING]);

      // Step 3: Verify the params the service decided to pass to the repo
      expect(updateStub.calledOnce).to.be.true;
      expect(updateStub.firstCall.args[0]).to.equal(GROUP_ID);
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
      // Verifies: a processing→ready transition stamps completed_at (not started_at).

      // Step 1: Stub the group fetch to return a PROCESSING group
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionExportRepository.prototype, 'getExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.PROCESSING }));
      const updateStub = sinon
        .stub(DownloadVersionExportRepository.prototype, 'updateExportArtifactGroupStatus')
        .resolves();

      // Step 2: Perform the transition
      await service.transitionGroupStatus(GROUP_ID, DownloadStatusEnum.READY, [DownloadStatusEnum.PROCESSING]);

      // Step 3: Verify only completed_at is set
      const metadata = updateStub.firstCall.args[2] as {
        started_at?: string;
        completed_at?: string;
        error_message?: string;
      };
      expect(metadata.started_at).to.be.undefined;
      expect(metadata.completed_at).to.be.a('string');
    });

    it('sets completed_at and error_message in repo call on processing→failed transition', async () => {
      // Verifies: a processing→failed transition stamps completed_at and re-keys error → error_message.

      // Step 1: Stub the group fetch to return a PROCESSING group
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionExportRepository.prototype, 'getExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.PROCESSING }));
      const updateStub = sinon
        .stub(DownloadVersionExportRepository.prototype, 'updateExportArtifactGroupStatus')
        .resolves();

      // Step 2: Perform the failing transition with an error string
      await service.transitionGroupStatus(
        GROUP_ID,
        DownloadStatusEnum.FAILED,
        [DownloadStatusEnum.PENDING, DownloadStatusEnum.PROCESSING],
        { error: 'oops' }
      );

      // Step 3: Verify error_message + completed_at landed
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
    it('reads the version artifacts from the version id, not the download id', async () => {
      // Verifies: discovery queries the version's link table by downloadVersionId, decoupling the
      // artifact set from the download id (the download id is only used to validate the key shape).
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      const listStub = sinon
        .stub(DownloadVersionRepository.prototype, 'listDownloadVersionArtifactsByDownloadVersionId')
        .resolves([]);

      await service.listExportFeatureTypes(DOWNLOAD_ID, DOWNLOAD_VERSION_ID);

      expect(listStub).to.have.been.calledOnceWith(DOWNLOAD_VERSION_ID);
    });

    it('returns empty array when no artifacts exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon.stub(DownloadVersionRepository.prototype, 'listDownloadVersionArtifactsByDownloadVersionId').resolves([]);

      const result = await service.listExportFeatureTypes(DOWNLOAD_ID, DOWNLOAD_VERSION_ID);

      expect(result).to.deep.equal([]);
    });

    it('extracts feature type names from valid Parquet keys', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon.stub(DownloadVersionRepository.prototype, 'listDownloadVersionArtifactsByDownloadVersionId').resolves([
        {
          artifact_id: 'bbbb0000-0000-0000-0000-000000000001',
          object_key: `downloads/${DOWNLOAD_ID}/versions/${DOWNLOAD_VERSION_ID}/dataset/data.parquet`
        },
        {
          artifact_id: 'bbbb0000-0000-0000-0000-000000000002',
          object_key: `downloads/${DOWNLOAD_ID}/versions/${DOWNLOAD_VERSION_ID}/observation/data.parquet`
        }
      ]);

      const result = await service.listExportFeatureTypes(DOWNLOAD_ID, DOWNLOAD_VERSION_ID);

      expect(result).to.have.members(['dataset', 'observation']);
      expect(result).to.have.lengthOf(2);
    });

    it('filters out non-Parquet artifacts', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon.stub(DownloadVersionRepository.prototype, 'listDownloadVersionArtifactsByDownloadVersionId').resolves([
        {
          artifact_id: 'bbbb0000-0000-0000-0000-000000000001',
          object_key: `downloads/${DOWNLOAD_ID}/versions/${DOWNLOAD_VERSION_ID}/observation/data.parquet`
        },
        {
          artifact_id: 'bbbb0000-0000-0000-0000-000000000002',
          object_key: `downloads/${DOWNLOAD_ID}/versions/${DOWNLOAD_VERSION_ID}/exports/${GROUP_ID}/biohub-${GROUP_ID}-part-1.zip`
        }
      ]);

      const result = await service.listExportFeatureTypes(DOWNLOAD_ID, DOWNLOAD_VERSION_ID);

      expect(result).to.deep.equal(['observation']);
    });

    it('parses keys against the download id — a version artifact keyed under a different download yields no feature type', async () => {
      // Verifies: even though artifacts are discovered from the version link table, the Parquet key
      // still embeds the download id, and the parse validates against `downloadId`. A key shaped for
      // a *different* download id (`downloads/<other>/observation/...`) must not surface as a feature
      // type for this download, while a key with the right download id does.
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      const otherDownloadId = 'ffff0000-0000-0000-0000-000000000999';
      sinon.stub(DownloadVersionRepository.prototype, 'listDownloadVersionArtifactsByDownloadVersionId').resolves([
        {
          artifact_id: 'bbbb0000-0000-0000-0000-000000000001',
          object_key: `downloads/${DOWNLOAD_ID}/versions/${DOWNLOAD_VERSION_ID}/observation/data.parquet`
        },
        {
          artifact_id: 'bbbb0000-0000-0000-0000-000000000002',
          object_key: `downloads/${otherDownloadId}/versions/${DOWNLOAD_VERSION_ID}/dataset/data.parquet`
        }
      ]);

      const result = await service.listExportFeatureTypes(DOWNLOAD_ID, DOWNLOAD_VERSION_ID);

      // Only the key matching DOWNLOAD_ID resolves to a feature type; the foreign-download key is dropped.
      expect(result).to.deep.equal(['observation']);
    });
  });

  describe('runExportGroup', () => {
    const mockCodes: FeatureTypeWithProperties[] = [
      {
        feature_type: {
          feature_type_id: 1,
          name: 'observation',
          display_name: 'Observation',
          description: null
        },
        properties: [
          {
            feature_type_property_id: 1,
            name: 'species',
            display_name: 'Species',
            description: 'Species',
            type_name: FEATURE_PROPERTY_TYPE.STRING,
            required_value: false,
            calculated_value: false,
            allow_multiple: false
          }
        ]
      }
    ];

    it('transitions PROCESSING then READY on happy path and discovers feature types from the pinned version', async () => {
      // Verifies: the orchestrator resolves the version from the GROUP (group.download_version_id),
      // discovers feature types keyed by that version, and brackets the work with
      // PROCESSING then READY transitions.

      // Step 1: Stub the group fetch + version resolution
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionExportRepository.prototype, 'getExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ download_version_id: DOWNLOAD_VERSION_ID }));
      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionById')
        .resolves({ download_version_id: DOWNLOAD_VERSION_ID, download_id: DOWNLOAD_ID });
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);

      // Step 2: Stub the transition + the streaming seams so no real S3/archiver runs
      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionGroupStatus').resolves();
      const listStub = sinon
        .stub(DownloadExportPipelineService.prototype, 'listExportFeatureTypes')
        .resolves(['observation']);
      sinon
        .stub(DownloadExportPipelineService.prototype, 'writeFeatureTypeExport')
        .resolves({ finalPart: 1, chunksWritten: 1, fileRefs: [] });
      sinon
        .stub(DownloadExportPipelineService.prototype, 'writePartZip')
        .resolves({ artifactId: 'bbbb0000-0000-0000-0000-000000000010', byteCount: 128 });

      // Step 3: Run the group
      await service.runExportGroup(GROUP_ID);

      // Step 4: Verify the bracketing transitions fired in order with the right allowed-status sets
      expect(transitionStub.callCount).to.equal(2);
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      expect(transitionStub.firstCall.args[2]).to.deep.equal([
        DownloadStatusEnum.PENDING,
        DownloadStatusEnum.PROCESSING
      ]);
      expect(transitionStub.secondCall.args[1]).to.equal(DownloadStatusEnum.READY);
      expect(transitionStub.secondCall.args[2]).to.deep.equal([DownloadStatusEnum.PROCESSING]);

      // Step 5: Discovery is keyed by the version pinned on the group; the download id is passed
      // alongside only so the key parse can validate against it.
      expect(listStub).to.have.been.calledOnceWith(DOWNLOAD_ID, DOWNLOAD_VERSION_ID);
    });

    it('throws when no Parquet artifacts exist for the version (avoids empty-zip output)', async () => {
      // Verifies: an empty feature-type discovery fails loud after PROCESSING and before any write.

      // Step 1: Stub group + version resolution
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionExportRepository.prototype, 'getExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup());
      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionById')
        .resolves({ download_version_id: DOWNLOAD_VERSION_ID, download_id: DOWNLOAD_ID });
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);

      // Step 2: Discovery returns no feature types
      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionGroupStatus').resolves();
      sinon.stub(DownloadExportPipelineService.prototype, 'listExportFeatureTypes').resolves([]);
      const writeStub = sinon.stub(DownloadExportPipelineService.prototype, 'writeFeatureTypeExport');
      const writePartStub = sinon.stub(DownloadExportPipelineService.prototype, 'writePartZip');

      // Step 3: Run — expect the empty-zip guard to throw
      try {
        await service.runExportGroup(GROUP_ID);
        expect.fail('expected throw');
      } catch (err: any) {
        expect(err.message).to.include('no Parquet artifacts');
      }

      // Step 4: Only PROCESSING fired — READY was never reached, and no work was done.
      expect(transitionStub.calledOnce).to.be.true;
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      expect(writeStub.called).to.be.false;
      expect(writePartStub.called).to.be.false;
    });

    it('throws when every feature type resolves to zero rows (avoids empty-zip output)', async () => {
      // Verifies: even with discovered feature types, a zero-row export fails loud before READY.

      // Step 1: Stub group + version resolution
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionExportRepository.prototype, 'getExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup());
      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionById')
        .resolves({ download_version_id: DOWNLOAD_VERSION_ID, download_id: DOWNLOAD_ID });
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);

      // Step 2: One feature type discovered, but the writer reports zero chunks written
      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionGroupStatus').resolves();
      sinon.stub(DownloadExportPipelineService.prototype, 'listExportFeatureTypes').resolves(['observation']);
      sinon
        .stub(DownloadExportPipelineService.prototype, 'writeFeatureTypeExport')
        .resolves({ finalPart: 1, chunksWritten: 0, fileRefs: [] });
      const writePartStub = sinon.stub(DownloadExportPipelineService.prototype, 'writePartZip');

      // Step 3: Run — expect the zero-rows guard to throw
      try {
        await service.runExportGroup(GROUP_ID);
        expect.fail('expected throw');
      } catch (err: any) {
        expect(err.message).to.include('zero rows');
      }

      // Step 4: READY never fired, and no part-zips were finalized.
      expect(transitionStub.calledOnce).to.be.true;
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      expect(writePartStub.called).to.be.false;
    });

    it('propagates error from writeFeatureTypeExport and does not transition to READY', async () => {
      // Verifies: a writer error aborts the part loop before any finalize and never reaches READY.

      // Step 1: Stub group + version resolution
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionExportRepository.prototype, 'getExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup());
      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionById')
        .resolves({ download_version_id: DOWNLOAD_VERSION_ID, download_id: DOWNLOAD_ID });
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);

      // Step 2: The writer rejects
      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionGroupStatus').resolves();
      sinon.stub(DownloadExportPipelineService.prototype, 'listExportFeatureTypes').resolves(['observation']);
      sinon.stub(DownloadExportPipelineService.prototype, 'writeFeatureTypeExport').rejects(new Error('boom'));
      const writePartStub = sinon.stub(DownloadExportPipelineService.prototype, 'writePartZip').resolves({
        artifactId: 'bbbb0000-0000-0000-0000-000000000010',
        byteCount: 0
      });

      // Step 3: Run — expect the writer error to bubble up
      try {
        await service.runExportGroup(GROUP_ID);
        expect.fail('expected throw');
      } catch (err: any) {
        expect(err.message).to.equal('boom');
      }

      // Step 4: Only the PROCESSING transition fired — READY was never reached.
      expect(transitionStub.calledOnce).to.be.true;
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      // writePartZip must not fire either — the error aborted the part loop before any finalize.
      expect(writePartStub.called).to.be.false;
    });
  });

  describe('writeFeatureTypeExport row loop', () => {
    /**
     * Captured archive entry — `data` resolves once the entry's PassThrough
     * closes (the writer calls `entry.end()` on roll-over or drain).
     */
    interface CapturedEntry {
      name: string;
      data: Promise<string>;
    }

    /**
     * Build a fake `PartArchiverBundle` whose `archive.append` records each
     * appended PassThrough's eventual contents into `captured`. The writer
     * code touches `archive.append`, `archive.on('error', ...)` (only in
     * `createPartArchiverBundle`, not in the row loop), and updates
     * `bundle.byteCount` directly — nothing else from a real bundle is
     * needed for this test.
     */
    function makeCapturingBundle(captured: CapturedEntry[]) {
      const bundle = {
        archive: {
          append: (entry: PassThrough, opts: { name: string }) => {
            const data = new Promise<string>((resolve) => {
              const buffers: Buffer[] = [];
              entry.on('data', (chunk: Buffer) => buffers.push(chunk));
              entry.on('end', () => resolve(Buffer.concat(buffers).toString('utf8')));
            });
            captured.push({ name: opts.name, data });
          },
          on: () => undefined
        },
        uploadPromise: Promise.resolve(),
        passThrough: new PassThrough(),
        hashCount: { transform: new PassThrough(), getResult: () => ({ sha256Hex: '', byteCount: 0 }) },
        byteCount: 0n
      };
      return bundle as any;
    }

    /** Fake Parquet reader exposing a one-shot cursor over the supplied rows. */
    function makeFakeReader(rows: Record<string, unknown>[]) {
      let i = 0;
      return {
        getCursor: () => ({
          next: async () => (i < rows.length ? rows[i++] : null)
        }),
        close: async () => undefined
      } as any;
    }

    const properties: CsvPropertyDefinition[] = [
      { feature_property_name: 'name', feature_property_type_name: 'string' }
    ];

    it('writes header on every chunk including chunks opened after a roll-over', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      const captured: CapturedEntry[] = [];
      const archiverByPart = new Map<number, unknown>();
      archiverByPart.set(1, makeCapturingBundle(captured));

      // Tiny threshold + 3 rows so each row triggers a roll. The look-ahead
      // confirms more rows exist on the first two rolls; the third returns
      // null so the writer drains cleanly without a fourth empty chunk.
      const reader = makeFakeReader([
        { submission_feature_id: 11, uuid: 'u-a', parent_uuid: 'p-a', name: 'row-a' },
        { submission_feature_id: 22, uuid: 'u-b', parent_uuid: 'p-b', name: 'row-b' },
        { submission_feature_id: 33, uuid: 'u-c', parent_uuid: null, name: 'row-c' }
      ]);
      sinon.stub(service as any, 'openParquetReader').resolves(reader);

      const result1 = await service.writeFeatureTypeExport({
        groupId: GROUP_ID,
        downloadId: DOWNLOAD_ID,
        downloadVersionId: DOWNLOAD_VERSION_ID,
        featureTypeName: 'observation',
        properties,
        maxPartSizeBytes: 1n,
        archiverByPart: archiverByPart as any,
        currentPart: 1
      });
      expect(result1.pendingRow).to.deep.equal({
        submission_feature_id: 22,
        uuid: 'u-b',
        parent_uuid: 'p-b',
        name: 'row-b'
      });
      expect(result1.finalPart).to.equal(2);

      archiverByPart.set(2, makeCapturingBundle(captured));
      const result2 = await service.writeFeatureTypeExport({
        groupId: GROUP_ID,
        downloadId: DOWNLOAD_ID,
        downloadVersionId: DOWNLOAD_VERSION_ID,
        featureTypeName: 'observation',
        properties,
        maxPartSizeBytes: 1n,
        archiverByPart: archiverByPart as any,
        currentPart: result1.finalPart,
        resumeReader: result1.pendingReader,
        resumeCursor: result1.pendingCursor,
        resumeChunkIndex: result1.pendingChunkIndex,
        resumeRow: result1.pendingRow
      });
      expect(result2.pendingRow).to.deep.equal({
        submission_feature_id: 33,
        uuid: 'u-c',
        parent_uuid: null,
        name: 'row-c'
      });
      expect(result2.finalPart).to.equal(3);

      archiverByPart.set(3, makeCapturingBundle(captured));
      const result3 = await service.writeFeatureTypeExport({
        groupId: GROUP_ID,
        downloadId: DOWNLOAD_ID,
        downloadVersionId: DOWNLOAD_VERSION_ID,
        featureTypeName: 'observation',
        properties,
        maxPartSizeBytes: 1n,
        archiverByPart: archiverByPart as any,
        currentPart: result2.finalPart,
        resumeReader: result2.pendingReader,
        resumeCursor: result2.pendingCursor,
        resumeChunkIndex: result2.pendingChunkIndex,
        resumeRow: result2.pendingRow
      });
      expect(result3.pendingRow).to.be.undefined;
      expect(result3.finalPart).to.equal(3);

      // Three chunks captured, monotonic chunk1 → chunk2 → chunk3.
      expect(captured.map((c) => c.name)).to.deep.equal([
        `biohub-export-${GROUP_ID}/observation/chunk1.csv`,
        `biohub-export-${GROUP_ID}/observation/chunk2.csv`,
        `biohub-export-${GROUP_ID}/observation/chunk3.csv`
      ]);

      // Every chunk starts with the header line — no header-less chunks even
      // though only chunk1 was historically header-bearing. submission_feature_id
      // is the leading column.
      const contents = await Promise.all(captured.map((c) => c.data));
      expect(contents[0]).to.equal('submission_feature_id,uuid,parent_uuid,name\n11,u-a,p-a,row-a\n');
      expect(contents[1]).to.equal('submission_feature_id,uuid,parent_uuid,name\n22,u-b,p-b,row-b\n');
      // Root rows have null parent_uuid; the column is empty rather than the literal "null".
      expect(contents[2]).to.equal('submission_feature_id,uuid,parent_uuid,name\n33,u-c,,row-c\n');
    });

    it('does not roll on the last row even when it crosses the part-size threshold (look-ahead avoids empty trailing part)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      const captured: CapturedEntry[] = [];
      const archiverByPart = new Map<number, unknown>();
      archiverByPart.set(1, makeCapturingBundle(captured));

      // One row that crosses the threshold. Without the look-ahead this
      // would close part 1 and ask the orchestrator to open part 2, which
      // would then finalize empty (the cursor has no more rows).
      const reader = makeFakeReader([
        { submission_feature_id: 99, uuid: 'u-only', parent_uuid: 'p-only', name: 'only-row' }
      ]);
      sinon.stub(service as any, 'openParquetReader').resolves(reader);

      const result = await service.writeFeatureTypeExport({
        groupId: GROUP_ID,
        downloadId: DOWNLOAD_ID,
        downloadVersionId: DOWNLOAD_VERSION_ID,
        featureTypeName: 'observation',
        properties,
        maxPartSizeBytes: 1n,
        archiverByPart: archiverByPart as any,
        currentPart: 1
      });

      // No roll: pending fields are absent, and finalPart stayed at 1.
      expect(result.finalPart).to.equal(1);
      expect(result.pendingRow).to.be.undefined;
      expect(result.pendingReader).to.be.undefined;
      expect(result.pendingCursor).to.be.undefined;
      expect(result.pendingChunkIndex).to.be.undefined;

      // Exactly one chunk entry was opened — the look-ahead saw `null` and
      // closed cleanly instead of opening an empty chunk2.
      expect(captured).to.have.lengthOf(1);
      expect(captured[0].name).to.equal(`biohub-export-${GROUP_ID}/observation/chunk1.csv`);
      expect(await captured[0].data).to.equal(
        'submission_feature_id,uuid,parent_uuid,name\n99,u-only,p-only,only-row\n'
      );
    });

    it('coerces BigInt submission_feature_id (returned by INT64 Parquet reads) to number for the CSV column', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      const captured: CapturedEntry[] = [];
      const archiverByPart = new Map<number, unknown>();
      archiverByPart.set(1, makeCapturingBundle(captured));

      // @dsnp/parquetjs decodes INT64 columns as BigInt; the writer accepts
      // both number and BigInt input. Asserting we don't crash and the value
      // round-trips as a base-10 string in the CSV column.
      const reader = makeFakeReader([
        { submission_feature_id: 4242n, uuid: 'u-big', parent_uuid: null, name: 'big-row' }
      ]);
      sinon.stub(service as any, 'openParquetReader').resolves(reader);

      await service.writeFeatureTypeExport({
        groupId: GROUP_ID,
        downloadId: DOWNLOAD_ID,
        downloadVersionId: DOWNLOAD_VERSION_ID,
        featureTypeName: 'observation',
        properties,
        maxPartSizeBytes: 1_000_000n,
        archiverByPart: archiverByPart as any,
        currentPart: 1
      });

      expect(await captured[0].data).to.equal('submission_feature_id,uuid,parent_uuid,name\n4242,u-big,,big-row\n');
    });

    it('throws if a Parquet row is missing submission_feature_id', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      const captured: CapturedEntry[] = [];
      const archiverByPart = new Map<number, unknown>();
      archiverByPart.set(1, makeCapturingBundle(captured));

      // Refuse rather than silently emit `0_*.bin` filename collisions.
      const reader = makeFakeReader([{ name: 'orphan-row' }]);
      sinon.stub(service as any, 'openParquetReader').resolves(reader);

      try {
        await service.writeFeatureTypeExport({
          groupId: GROUP_ID,
          downloadId: DOWNLOAD_ID,
          downloadVersionId: DOWNLOAD_VERSION_ID,
          featureTypeName: 'observation',
          properties,
          maxPartSizeBytes: 1_000_000n,
          archiverByPart: archiverByPart as any,
          currentPart: 1
        });
        expect.fail('expected throw');
      } catch (err: any) {
        expect(err.message).to.include('missing submission_feature_id');
      }
    });

    it('rolls based on projected binary byte_size, not just CSV bytes (binary attachments factored into the cap)', async () => {
      // Regression: previously the rollover check counted only CSV bytes, so a
      // part with small CSV but huge artifact_key attachments would stay open
      // and `streamBinariesToPart` would later balloon the part-zip well past
      // `max_part_size_bytes`. The fix sums `artifact.byte_size` for each
      // attachment into the bundle's projected byteCount so the roll fires
      // before the binaries are appended.
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      const captured: CapturedEntry[] = [];
      const archiverByPart = new Map<number, unknown>();
      archiverByPart.set(1, makeCapturingBundle(captured));

      // CSV rows are tiny (~30 bytes each), but each row references a 1 MB
      // attachment via the artifact_key column. With a 1.5 MB cap, row 1's
      // 1 MB binary projection sits under the cap (CSV+1MB ≈ 1.0 MB), but
      // row 2's projection pushes the running total to ~2 MB → roll. Row 3
      // exists so the look-ahead at roll time confirms more rows remain
      // (otherwise the writer would close cleanly to avoid an empty
      // trailing part).
      const reader = makeFakeReader([
        { submission_feature_id: 1, uuid: 'u-1', parent_uuid: null, attachment: 's3/photo-1.jpg' },
        { submission_feature_id: 2, uuid: 'u-2', parent_uuid: null, attachment: 's3/photo-2.jpg' },
        { submission_feature_id: 3, uuid: 'u-3', parent_uuid: null, attachment: 's3/photo-3.jpg' }
      ]);
      sinon.stub(service as any, 'openParquetReader').resolves(reader);

      const sizeStub = sinon
        .stub(ArtifactService.prototype, 'getArtifactByteSizesByObjectKeys')
        .callsFake(async (_bucket: string, keys: string[]) => {
          const m = new Map<string, number>();
          for (const k of keys) {
            m.set(k, 1_000_000);
          }
          return m;
        });

      const propsWithArtifact: CsvPropertyDefinition[] = [
        { feature_property_name: 'attachment', feature_property_type_name: 'artifact_key' }
      ];

      const result = await service.writeFeatureTypeExport({
        groupId: GROUP_ID,
        downloadId: DOWNLOAD_ID,
        downloadVersionId: DOWNLOAD_VERSION_ID,
        featureTypeName: 'observation',
        properties: propsWithArtifact,
        maxPartSizeBytes: 1_500_000n,
        archiverByPart: archiverByPart as any,
        currentPart: 1
      });

      // Roll fired after row 2's binary projection. fileRefs for part 1
      // include rows 1 and 2 because both were appended to part 1 before
      // the roll committed; row 3 is handed back as the pending look-ahead
      // for the next part.
      expect(result.finalPart).to.equal(2);
      expect(result.pendingRow).to.deep.equal({
        submission_feature_id: 3,
        uuid: 'u-3',
        parent_uuid: null,
        attachment: 's3/photo-3.jpg'
      });
      expect(result.fileRefs).to.have.lengthOf(2);
      expect(result.fileRefs.map((r) => r.partIndex)).to.deep.equal([1, 1]);
      // The byteCount must reflect both binaries (2_000_000) plus the small
      // CSV — confirming the projection landed. (chai's `greaterThan` doesn't
      // accept bigint, so compare directly.)
      const bundle = archiverByPart.get(1) as { byteCount: bigint };
      expect(bundle.byteCount > 2_000_000n).to.be.true;

      // Without the projection, both 30-byte rows would have fit in 1.5 MB
      // and no roll would have fired — the lookup's role is observable.
      expect(sizeStub.called).to.be.true;
    });

    it('treats unknown artifact keys (no DB row) as zero bytes — best-effort projection', async () => {
      // A reference whose artifact row was deleted / never landed in the
      // table should not block the export; the streaming path already writes
      // a `.error.txt` placeholder for the missing object. The projection
      // contributes 0 for this key so the part finalizes cleanly.
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      const captured: CapturedEntry[] = [];
      const archiverByPart = new Map<number, unknown>();
      archiverByPart.set(1, makeCapturingBundle(captured));

      const reader = makeFakeReader([
        { submission_feature_id: 1, uuid: 'u-1', parent_uuid: null, attachment: 's3/missing.jpg' }
      ]);
      sinon.stub(service as any, 'openParquetReader').resolves(reader);

      // Empty map = unknown key.
      sinon.stub(ArtifactService.prototype, 'getArtifactByteSizesByObjectKeys').resolves(new Map<string, number>());

      const propsWithArtifact: CsvPropertyDefinition[] = [
        { feature_property_name: 'attachment', feature_property_type_name: 'artifact_key' }
      ];

      const result = await service.writeFeatureTypeExport({
        groupId: GROUP_ID,
        downloadId: DOWNLOAD_ID,
        downloadVersionId: DOWNLOAD_VERSION_ID,
        featureTypeName: 'observation',
        properties: propsWithArtifact,
        maxPartSizeBytes: 1_000_000n,
        archiverByPart: archiverByPart as any,
        currentPart: 1
      });

      // No roll, single row drained successfully.
      expect(result.finalPart).to.equal(1);
      expect(result.pendingRow).to.be.undefined;
      expect(result.fileRefs).to.have.lengthOf(1);
    });

    it('caches byte_size lookups across rows so the same key costs one DB hit', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      const captured: CapturedEntry[] = [];
      const archiverByPart = new Map<number, unknown>();
      archiverByPart.set(1, makeCapturingBundle(captured));

      // Three rows all reference the same artifact key. The cache turns
      // that into one repository call, not three.
      const reader = makeFakeReader([
        { submission_feature_id: 1, uuid: 'u-1', parent_uuid: null, attachment: 's3/shared.bin' },
        { submission_feature_id: 2, uuid: 'u-2', parent_uuid: null, attachment: 's3/shared.bin' },
        { submission_feature_id: 3, uuid: 'u-3', parent_uuid: null, attachment: 's3/shared.bin' }
      ]);
      sinon.stub(service as any, 'openParquetReader').resolves(reader);

      const sizeStub = sinon
        .stub(ArtifactService.prototype, 'getArtifactByteSizesByObjectKeys')
        .resolves(new Map([['s3/shared.bin', 100]]));

      const propsWithArtifact: CsvPropertyDefinition[] = [
        { feature_property_name: 'attachment', feature_property_type_name: 'artifact_key' }
      ];

      await service.writeFeatureTypeExport({
        groupId: GROUP_ID,
        downloadId: DOWNLOAD_ID,
        downloadVersionId: DOWNLOAD_VERSION_ID,
        featureTypeName: 'observation',
        properties: propsWithArtifact,
        maxPartSizeBytes: 1_000_000n,
        archiverByPart: archiverByPart as any,
        currentPart: 1
      });

      expect(sizeStub.callCount).to.equal(1);
      expect(sizeStub.firstCall.args[1]).to.deep.equal(['s3/shared.bin']);
    });

    it('rolls when more rows exist after the threshold-crossing row', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      const captured: CapturedEntry[] = [];
      const archiverByPart = new Map<number, unknown>();
      archiverByPart.set(1, makeCapturingBundle(captured));

      const reader = makeFakeReader([
        { submission_feature_id: 1, name: 'row-a' },
        { submission_feature_id: 2, name: 'row-b' }
      ]);
      sinon.stub(service as any, 'openParquetReader').resolves(reader);

      const result = await service.writeFeatureTypeExport({
        groupId: GROUP_ID,
        downloadId: DOWNLOAD_ID,
        downloadVersionId: DOWNLOAD_VERSION_ID,
        featureTypeName: 'observation',
        properties,
        maxPartSizeBytes: 1n,
        archiverByPart: archiverByPart as any,
        currentPart: 1
      });

      // Look-ahead found row-b → caller is told to roll and resume on it.
      expect(result.finalPart).to.equal(2);
      expect(result.pendingRow).to.deep.equal({ submission_feature_id: 2, name: 'row-b' });
      expect(result.pendingReader).to.not.be.undefined;
      expect(result.pendingCursor).to.not.be.undefined;
      expect(result.pendingChunkIndex).to.equal(2);
    });
  });

  describe('runExportGroup per-part file refs', () => {
    const mockCodes: FeatureTypeWithProperties[] = [
      {
        feature_type: {
          feature_type_id: 1,
          name: 'observation',
          display_name: 'Observation',
          description: null
        },
        properties: [
          {
            feature_type_property_id: 1,
            name: 'species',
            display_name: 'Species',
            description: 'Species',
            type_name: FEATURE_PROPERTY_TYPE.STRING,
            required_value: false,
            calculated_value: false,
            allow_multiple: false
          }
        ]
      }
    ];

    it('streams each part its own file refs only (per-part bookkeeping survives roll-over)', async () => {
      // Verifies: across a roll-over, each part's binary refs stream into that part only — finalized
      // parts' ref buckets are dropped so the per-part lookup stays bounded.

      // Step 1: Stub group + version resolution + schema lookup
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadExportPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionExportRepository.prototype, 'getExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup());
      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionById')
        .resolves({ download_version_id: DOWNLOAD_VERSION_ID, download_id: DOWNLOAD_ID });
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
      sinon.stub(DownloadExportPipelineService.prototype, 'transitionGroupStatus').resolves();
      sinon.stub(DownloadExportPipelineService.prototype, 'listExportFeatureTypes').resolves(['observation']);

      // Step 2: First writer call rolls (refs for part 1); second call drains (refs for part 2).
      const writeStub = sinon.stub(DownloadExportPipelineService.prototype, 'writeFeatureTypeExport');
      writeStub.onFirstCall().resolves({
        finalPart: 2,
        chunksWritten: 1,
        fileRefs: [
          { submissionFeatureId: 1, filePath: 's3/a.bin', partIndex: 1 },
          { submissionFeatureId: 2, filePath: 's3/b.bin', partIndex: 1 }
        ],
        pendingReader: {} as any,
        pendingCursor: {} as any,
        pendingChunkIndex: 2
      });
      writeStub.onSecondCall().resolves({
        finalPart: 2,
        chunksWritten: 1,
        fileRefs: [{ submissionFeatureId: 3, filePath: 's3/c.bin', partIndex: 2 }]
      });

      sinon.stub(DownloadExportPipelineService.prototype, 'writePartZip').resolves({
        artifactId: 'bbbb0000-0000-0000-0000-000000000010',
        byteCount: 1
      });
      // Avoid touching real S3 / archiver state when each part's refs stream in.
      const streamStub = sinon.stub(service as any, 'streamBinariesToPart').resolves();
      // The orchestrator constructs a real bundle per part for the writer call;
      // the writer is stubbed so the bundle is never read from. Just keep the
      // factory cheap.
      sinon.stub(service as any, 'createPartArchiverBundle').callsFake(() => ({
        archive: { on: () => undefined, abort: () => undefined } as any,
        uploadPromise: Promise.resolve(),
        passThrough: new PassThrough(),
        hashCount: { transform: new PassThrough(), getResult: () => ({ sha256Hex: '', byteCount: 0 }) },
        byteCount: 0n
      }));

      // Step 3: Run the group
      await service.runExportGroup(GROUP_ID);

      // Step 4: Two streamBinariesToPart calls — one per part. Each receives only its own part's
      // refs; finalized parts' ref buckets are dropped from the map.
      expect(streamStub.callCount).to.equal(2);
      const call1Refs = streamStub.firstCall.args[1] as { partIndex: number }[];
      const call2Refs = streamStub.secondCall.args[1] as { partIndex: number }[];
      expect(call1Refs).to.have.lengthOf(2);
      expect(call1Refs.every((r) => r.partIndex === 1)).to.be.true;
      expect(call2Refs).to.have.lengthOf(1);
      expect(call2Refs.every((r) => r.partIndex === 2)).to.be.true;
    });
  });
});
