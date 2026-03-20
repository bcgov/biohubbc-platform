import { expect } from 'chai';
import { describe } from 'mocha';
import { Readable } from 'node:stream';
import sinon from 'sinon';
import * as biohubTarParser from '../../utils/biohub-tar-parser';
import { getMockDBConnection } from '../../__mocks__/db';
import { ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { MediaIngestionService } from './media-ingestion-service';

describe('MediaIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('ingestMediaFiles', () => {
    it('persists extracted media artifacts with upload_archive lineage', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [] });
      const dbConnection = getMockDBConnection({ sql: sqlStub });
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon
        .stub(ArtifactService.prototype, 'insertArtifact')
        .onFirstCall()
        .resolves({ artifact_id: 'artifact-1' })
        .onSecondCall()
        .resolves({ artifact_id: 'artifact-2' });
      sinon
        .stub(biohubTarParser, 'streamMediaFromTarball')
        .callsFake(async (_stream, _storage, _prefix, onUploaded) => {
          await onUploaded?.({ fileName: 'photo-1.jpg', s3Key: 'submissions/123/media/photo-1.jpg', byteSize: 10 });
          await onUploaded?.({ fileName: 'photo-2.jpg', s3Key: 'submissions/123/media/photo-2.jpg', byteSize: 20 });
          return { uploadedCount: 2 };
        });

      await service.ingestMediaFiles('archive/key.tar', 123, 'upload-1', 'archive-1');

      expect(sqlStub.callCount).to.equal(2);

      const firstSql = sqlStub.firstCall.args[0] as { text: string; values: unknown[] };
      expect(firstSql.text).to.include('upload_artifact');
      expect(firstSql.text).to.include('upload_archive_id');
      expect(firstSql.values).to.include('upload-1');
      expect(firstSql.values).to.include('archive-1');
      expect(firstSql.values).to.include('feature');
      expect(firstSql.values).to.include('artifact-1');

      const secondSql = sqlStub.secondCall.args[0] as { text: string; values: unknown[] };
      expect(secondSql.values).to.include('artifact-2');
      expect(secondSql.values).to.include('archive-1');
    });

    it('propagates object storage extraction failures', async () => {
      const dbConnection = getMockDBConnection();
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(biohubTarParser, 'streamMediaFromTarball').rejects(new Error('media stream extraction failed'));

      try {
        await service.ingestMediaFiles('archive/key.tar', 123, 'upload-1', 'archive-1');
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('media stream extraction failed');
      }
    });

    it('propagates artifact insert failures', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [] });
      const dbConnection = getMockDBConnection({ sql: sqlStub });
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(ArtifactService.prototype, 'insertArtifact').rejects(new Error('insert artifact failed'));
      sinon
        .stub(biohubTarParser, 'streamMediaFromTarball')
        .callsFake(async (_stream, _storage, _prefix, onUploaded) => {
          await onUploaded?.({ fileName: 'photo-1.jpg', s3Key: 'submissions/123/media/photo-1.jpg', byteSize: 10 });
          return { uploadedCount: 1 };
        });

      try {
        await service.ingestMediaFiles('archive/key.tar', 123, 'upload-1', 'archive-1');
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('insert artifact failed');
      }

      expect(sqlStub.called).to.be.false;
    });

    it('propagates upload_artifact insert failures after artifact creation', async () => {
      const sqlStub = sinon.stub().rejects(new Error('insert upload_artifact failed'));
      const dbConnection = getMockDBConnection({ sql: sqlStub });
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(ArtifactService.prototype, 'insertArtifact').resolves({ artifact_id: 'artifact-1' } as any);
      sinon
        .stub(biohubTarParser, 'streamMediaFromTarball')
        .callsFake(async (_stream, _storage, _prefix, onUploaded) => {
          await onUploaded?.({ fileName: 'photo-1.jpg', s3Key: 'submissions/123/media/photo-1.jpg', byteSize: 10 });
          return { uploadedCount: 1 };
        });

      try {
        await service.ingestMediaFiles('archive/key.tar', 123, 'upload-1', 'archive-1');
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('insert upload_artifact failed');
      }
    });

    it('uses idempotent ON CONFLICT clause for upload_artifact linkage', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [] });
      const dbConnection = getMockDBConnection({ sql: sqlStub });
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(ArtifactService.prototype, 'insertArtifact').resolves({ artifact_id: 'artifact-1' } as any);
      sinon
        .stub(biohubTarParser, 'streamMediaFromTarball')
        .callsFake(async (_stream, _storage, _prefix, onUploaded) => {
          await onUploaded?.({ fileName: 'photo-1.jpg', s3Key: 'submissions/123/media/photo-1.jpg', byteSize: 10 });
          return { uploadedCount: 1 };
        });

      await service.ingestMediaFiles('archive/key.tar', 123, 'upload-1', 'archive-1');

      const sqlText = (sqlStub.firstCall.args[0] as { text: string }).text;
      expect(sqlText).to.include('ON CONFLICT (upload_id, artifact_id) DO NOTHING');
    });
  });
});
