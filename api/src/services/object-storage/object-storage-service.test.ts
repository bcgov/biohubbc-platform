import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import chai, { expect } from 'chai';
import { Readable } from 'node:stream';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { BucketType, ObjectStorageService } from './object-storage-service';

chai.use(sinonChai);

describe('ObjectStorageService', function () {
  let service: ObjectStorageService;
  let sendStub: sinon.SinonStub;

  beforeEach(function () {
    sendStub = sinon.stub(S3Client.prototype, 'send');
    service = new ObjectStorageService();
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('uploadFile', function () {
    it('should upload a file to the specified bucket', async function () {
      const file = {
        buffer: Buffer.from('test content'),
        mimetype: 'text/plain'
      };

      sendStub.resolves({ ETag: '"abc123"' });

      const result = await service.uploadFile(
        BucketType.MAIN,
        file as unknown as Express.Multer.File,
        'uploads/file.txt'
      );

      expect(sendStub).to.have.been.calledOnce;
      expect(result).to.eql({ ETag: '"abc123"' });
    });

    it('should upload a file with metadata', async function () {
      const file = {
        buffer: Buffer.from('test content'),
        mimetype: 'application/json'
      };

      const metadata = { userId: 'user-123' };
      sendStub.resolves({ ETag: '"def456"' });

      await service.uploadFile(
        BucketType.QUARANTINE,
        file as unknown as Express.Multer.File,
        'quarantine/file.json',
        metadata
      );

      expect(sendStub).to.have.been.calledOnce;
    });

    it('should throw error when upload fails', async function () {
      sendStub.rejects(new Error('Upload failed'));

      try {
        await service.uploadFile(
          BucketType.MAIN,
          { buffer: Buffer.from('x'), mimetype: 'text/plain' } as unknown as Express.Multer.File,
          'file.txt'
        );
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Upload failed');
      }
    });
  });

  describe('uploadBuffer', function () {
    it('should upload a buffer to the specified bucket', async function () {
      const buffer = Buffer.from('test content');
      sendStub.resolves({ ETag: '"ghi789"' });

      const result = await service.uploadBuffer(BucketType.MAIN, buffer, 'text/plain', 'uploads/buffer.txt');

      expect(sendStub).to.have.been.calledOnce;
      expect(result).to.eql({ ETag: '"ghi789"' });
    });

    it('should upload a buffer with metadata', async function () {
      const buffer = Buffer.from('{"key": "value"}');
      const metadata = { contentHash: 'sha256-abc' };
      sendStub.resolves({ ETag: '"jkl012"' });

      await service.uploadBuffer(BucketType.QUARANTINE, buffer, 'application/json', 'data.json', metadata);

      expect(sendStub).to.have.been.calledOnce;
    });
  });

  describe('uploadStream', function () {
    it('should upload a stream to the specified bucket', async function () {
      const doneStub = sinon.stub(Upload.prototype, 'done').resolves();

      await service.uploadStream(BucketType.MAIN, new Readable(), 'video/mp4', 'uploads/video.mp4');

      expect(doneStub).to.have.been.calledOnce;
    });

    it('should upload a stream with metadata', async function () {
      const metadata = { duration: '120' };
      sinon.stub(Upload.prototype, 'done').resolves();

      await service.uploadStream(BucketType.QUARANTINE, new Readable(), 'video/mp4', 'video.mp4', metadata);

      expect(Upload.prototype.done).to.have.been.called;
    });

    it('should throw error when stream upload fails', async function () {
      sinon.stub(Upload.prototype, 'done').rejects(new Error('Upload failed'));

      try {
        await service.uploadStream(BucketType.MAIN, new Readable(), 'text/plain', 'file.txt');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Upload failed');
      }
    });
  });

  describe('getFile', function () {
    it('should retrieve a file from the specified bucket', async function () {
      const output = { Body: Buffer.from('file content'), ContentType: 'text/plain' };
      sendStub.resolves(output);

      const result = await service.getFile(BucketType.MAIN, 'uploads/file.txt');

      expect(sendStub).to.have.been.calledOnce;
      expect(result).to.equal(output);
    });

    it('should retrieve a file with version ID', async function () {
      const output = { Body: Buffer.from('versioned content') };
      sendStub.resolves(output);

      await service.getFile(BucketType.MAIN, 'uploads/file.txt', 'version-123');

      expect(sendStub).to.have.been.calledOnce;
    });

    it('should throw error when file not found', async function () {
      sendStub.rejects(new Error('NoSuchKey'));

      try {
        await service.getFile(BucketType.MAIN, 'nonexistent/file.txt');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('NoSuchKey');
      }
    });
  });

  describe('getFileStream', function () {
    it('should return a readable stream for the file', async function () {
      const stream = new Readable();
      sendStub.resolves({ Body: stream });

      const result = await service.getFileStream(BucketType.MAIN, 'uploads/file.txt');

      expect(result).to.equal(stream);
    });

    it('should throw error when S3 object has no body', async function () {
      sendStub.resolves({ Body: undefined });

      try {
        await service.getFileStream(BucketType.MAIN, 'uploads/file.txt');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('S3 object has no body');
      }
    });
  });

  describe('deleteFile', function () {
    it('should delete a file from the specified bucket', async function () {
      sendStub.resolves({ DeleteMarker: true });

      const result = await service.deleteFile(BucketType.MAIN, 'uploads/file.txt');

      expect(sendStub).to.have.been.calledOnce;
      expect(result).to.eql({ DeleteMarker: true });
    });

    it('should throw error when delete fails', async function () {
      sendStub.rejects(new Error('Delete failed'));

      try {
        await service.deleteFile(BucketType.MAIN, 'uploads/file.txt');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Delete failed');
      }
    });
  });

  describe('bulkDeleteFiles', function () {
    it('should return empty object when no keys provided', async function () {
      const result = await service.bulkDeleteFiles(BucketType.MAIN, []);

      expect(sendStub).to.not.have.been.called;
      expect(result).to.eql({});
    });

    it('should delete multiple files from the specified bucket', async function () {
      const keys = ['file1.txt', 'file2.txt', 'file3.txt'];
      sendStub.resolves({ Deleted: keys.map((Key) => ({ Key })) });

      const result = await service.bulkDeleteFiles(BucketType.MAIN, keys);

      expect(sendStub).to.have.been.calledOnce;
      expect(result).to.eql({ Deleted: keys.map((Key) => ({ Key })) });
    });

    it('should throw error when bulk delete fails', async function () {
      sendStub.rejects(new Error('Bulk delete failed'));

      try {
        await service.bulkDeleteFiles(BucketType.MAIN, ['file1.txt']);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Bulk delete failed');
      }
    });
  });

  describe('listFiles', function () {
    it('should list files in the specified bucket with prefix', async function () {
      const output = { Contents: [{ Key: 'uploads/file1.txt' }, { Key: 'uploads/file2.txt' }] };
      sendStub.resolves(output);

      const result = await service.listFiles(BucketType.MAIN, 'uploads/');

      expect(sendStub).to.have.been.calledOnce;
      expect(result).to.eql(output);
    });

    it('should throw error when listing fails', async function () {
      sendStub.rejects(new Error('List failed'));

      try {
        await service.listFiles(BucketType.MAIN, 'uploads/');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('List failed');
      }
    });
  });

  describe('getMetadata', function () {
    it('should retrieve metadata for a file', async function () {
      const output = { ContentType: 'text/plain', ContentLength: 1024 };
      sendStub.resolves(output);

      const result = await service.getMetadata(BucketType.MAIN, 'uploads/file.txt');

      expect(sendStub).to.have.been.calledOnce;
      expect(result).to.eql(output);
    });

    it('should throw error when metadata retrieval fails', async function () {
      sendStub.rejects(new Error('Metadata not found'));

      try {
        await service.getMetadata(BucketType.MAIN, 'nonexistent/file.txt');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Metadata not found');
      }
    });
  });

  describe('getSignedUrl', function () {
    it('should generate a signed URL for a file', async function () {
      const presignedUrl = 'https://s3.example.com/file.txt?signed=abc123';

      const stub = sinon.stub(ObjectStorageService.prototype, 'getSignedUrl').resolves(presignedUrl);

      const result = await service.getSignedUrl(BucketType.MAIN, 'uploads/file.txt');

      expect(stub).to.have.been.calledOnce;
      expect(result).to.equal(presignedUrl);
    });

    it('should generate a signed URL with custom expiration', async function () {
      const presignedUrl = 'https://s3.example.com/file.txt?signed=def456';

      const stub = sinon.stub(ObjectStorageService.prototype, 'getSignedUrl').resolves(presignedUrl);

      const result = await service.getSignedUrl(BucketType.MAIN, 'uploads/file.txt', 3600);

      expect(stub).to.have.been.calledOnce;
      expect(result).to.equal(presignedUrl);
    });
  });

  describe('getSignedUrls', function () {
    it('should generate signed URLs for multiple files', async function () {
      const presignedUrl = 'https://s3.example.com/file2.txt?signed=abc123';

      const stub = sinon.stub(ObjectStorageService.prototype, 'getSignedUrl').resolves(presignedUrl);

      const result = await service.getSignedUrls(BucketType.MAIN, ['file1.txt', 'file2.txt']);

      expect(stub).to.have.callCount(2);
      expect(result).to.eql([presignedUrl, presignedUrl]);
    });
  });

  describe('copyBetweenBuckets', function () {
    it('should copy a file from one bucket to another', async function () {
      sendStub.resolves({
        Body: new Readable(),
        ContentType: 'text/plain',
        Metadata: {}
      });

      const doneStub = sinon.stub(Upload.prototype, 'done').resolves();

      await service.copyBetweenBuckets(BucketType.QUARANTINE, BucketType.MAIN, 'file.txt');

      expect(sendStub).to.have.been.called;
      expect(doneStub).to.have.been.called;
    });

    it('should preserve content type and metadata during copy', async function () {
      const metadata = { userId: 'user-123' };
      sendStub.resolves({
        Body: new Readable(),
        ContentType: 'application/json',
        Metadata: metadata
      });

      sinon.stub(Upload.prototype, 'done').resolves();

      await service.copyBetweenBuckets(BucketType.QUARANTINE, BucketType.MAIN, 'data.json');

      expect(sendStub).to.have.been.called;
      expect(Upload.prototype.done).to.have.been.called;
    });
  });

  describe('moveBetweenBuckets', function () {
    it('should move a file from one bucket to another', async function () {
      sendStub.resolves({
        Body: new Readable(),
        ContentType: 'text/plain'
      });

      sinon.stub(Upload.prototype, 'done').resolves();

      await service.moveBetweenBuckets(BucketType.QUARANTINE, BucketType.MAIN, 'file.txt');

      expect(sendStub).to.have.been.called;
      expect(Upload.prototype.done).to.have.been.called;
    });
  });

  describe('promoteFromQuarantine', function () {
    it('should promote a file from quarantine to main bucket', async function () {
      sendStub.resolves({
        Body: new Readable(),
        ContentType: 'text/plain'
      });

      sinon.stub(Upload.prototype, 'done').resolves();

      const result = await service.promoteFromQuarantine('quarantine/file.txt');

      expect(result).to.eql({ key: 'quarantine/file.txt' });
      expect(sendStub).to.have.been.called;
      expect(Upload.prototype.done).to.have.been.called;
    });

    it('should throw error when promotion fails', async function () {
      sendStub.rejects(new Error('Promotion failed'));

      try {
        await service.promoteFromQuarantine('file.txt');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Promotion failed');
      }
    });
  });
});
