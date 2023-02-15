import AWS from 'aws-sdk';
import { Metadata } from 'aws-sdk/clients/appstream';
import { ManagedUpload } from 'aws-sdk/clients/s3';
import { expect } from 'chai';
import clamd from 'clamdjs';
import { describe } from 'mocha';
import sinon from 'sinon';
import * as fileUtils from './file-utils';

const generateStubs = () => {
  const _getObjectStoreUrlStub = sinon.stub(fileUtils, '_getObjectStoreUrl').returns('object.store.url');

  const _getObjectStoreBucketNameStub = sinon
    .stub(fileUtils, '_getObjectStoreBucketName')
    .returns('object-store-bucket-name');

  const _getS3KeyPrefixStub = sinon.stub(fileUtils, '_getS3KeyPrefix').returns('platform-test');

  return {
    _getObjectStoreUrlStub,
    _getObjectStoreBucketNameStub,
    _getS3KeyPrefixStub
  };
};

describe('file-utils', () => {
  let sinonSandbox: sinon.SinonSandbox;

  beforeEach(() => {
    process.env.OBJECT_STORE_ACCESS_KEY_ID = 'object-store-access-key-id';
    process.env.OBJECT_STORE_SECRET_KEY_ID = 'object-store-secret-key-id';
  });

  afterEach(() => {
    sinon.restore();
    sinonSandbox?.restore();
  });

  describe('_getClamAvScanner', () => {
    it('should return a clamAv scanner client', () => {
      process.env.ENABLE_FILE_VIRUS_SCAN = 'true';
      process.env.CLAMAV_HOST = 'host';
      process.env.CLAMAV_PORT = '1111';

      const result = fileUtils._getClamAvScanner();
      expect(result).to.not.be.null;
    });

    it('should return null if enable file virus scan is not set to true', () => {
      process.env.ENABLE_FILE_VIRUS_SCAN = 'false';
      process.env.CLAMAV_HOST = 'host';
      process.env.CLAMAV_PORT = '1111';

      const result = fileUtils._getClamAvScanner();
      expect(result).to.be.null;
    });

    it('should return null if CLAMAV_HOST is not set', () => {
      process.env.ENABLE_FILE_VIRUS_SCAN = 'true';
      delete process.env.CLAMAV_HOST;
      process.env.CLAMAV_PORT = '1111';

      const result = fileUtils._getClamAvScanner();
      expect(result).to.be.null;
    });

    it('should return null if CLAMAV_PORT is not set', () => {
      process.env.ENABLE_FILE_VIRUS_SCAN = 'true';
      process.env.CLAMAV_HOST = 'host';
      delete process.env.CLAMAV_PORT;

      const result = fileUtils._getClamAvScanner();
      expect(result).to.be.null;
    });
  });

  describe('_getS3Client', () => {
    it('should return an S3 client', () => {
      const result = fileUtils._getS3Client();
      expect(result).to.be.instanceOf(AWS.S3);
    });

    it('constructs an S3 client', async () => {
      const { _getObjectStoreUrlStub } = generateStubs();
      const s3Stub = sinon.stub(AWS, 'S3').returns({});

      fileUtils._getS3Client();

      expect(_getObjectStoreUrlStub).to.be.calledOnce;
      expect(s3Stub).to.have.been.calledWith({
        endpoint: 'https://object.store.url/',
        accessKeyId: 'object-store-access-key-id',
        secretAccessKey: 'object-store-secret-key-id',
        signatureVersion: 'v4',
        s3ForcePathStyle: true,
        region: 'ca-central-1'
      });
    });
  });

  describe('_getObjectStoreUrl', () => {
    it('should return an object store bucket name', () => {
      process.env.OBJECT_STORE_URL = 'test-url1';

      const result = fileUtils._getObjectStoreUrl();
      expect(result).to.equal('test-url1');
    });

    it('should return its default value', () => {
      delete process.env.OBJECT_STORE_URL;

      const result = fileUtils._getObjectStoreUrl();
      expect(result).to.equal('nrs.objectstore.gov.bc.ca');
    });
  });

  describe('_getObjectStoreBucketName', () => {
    it('should return an object store bucket name', () => {
      process.env.OBJECT_STORE_BUCKET_NAME = 'test-bucket1';

      const result = fileUtils._getObjectStoreBucketName();
      expect(result).to.equal('test-bucket1');
    });

    it('should return its default value', () => {
      delete process.env.OBJECT_STORE_BUCKET_NAME;

      const result = fileUtils._getObjectStoreBucketName();
      expect(result).to.equal('');
    });
  });

  describe('_getS3KeyPrefix', () => {
    it('should return an s3 key prefix', () => {
      process.env.S3_KEY_PREFIX = 'test-platform1';

      const result = fileUtils._getS3KeyPrefix();
      expect(result).to.equal('test-platform1');
    });

    it('should return its default value', () => {
      delete process.env.S3_KEY_PREFIX;

      const result = fileUtils._getS3KeyPrefix();
      expect(result).to.equal('platform');
    });
  });

  describe('getS3HostUrl', () => {
    beforeEach(() => {
      process.env.OBJECT_STORE_URL = 's3.host.example.com';
      process.env.OBJECT_STORE_BUCKET_NAME = 'test-bucket-name';
    });

    it('should yield a default S3 host url', () => {
      delete process.env.OBJECT_STORE_URL;
      delete process.env.OBJECT_STORE_BUCKET_NAME;

      const result = fileUtils.getS3HostUrl();

      expect(result).to.equal('nrs.objectstore.gov.bc.ca');
    });

    it('should successfully produce an S3 host url', () => {
      const result = fileUtils.getS3HostUrl();

      expect(result).to.equal('s3.host.example.com/test-bucket-name');
    });

    it('should successfully append a key to an S3 host url', () => {
      const result = fileUtils.getS3HostUrl('my-test-file.txt');

      expect(result).to.equal('s3.host.example.com/test-bucket-name/my-test-file.txt');
    });
  });

  describe('deleteFileFromS3', () => {
    it('returns null when no key specified', async () => {
      const result = await fileUtils.deleteFileFromS3(null as unknown as string);

      expect(result).to.be.null;
    });

    it('deletes a file', async () => {
      sinonSandbox = sinon.createSandbox();
      const { _getObjectStoreBucketNameStub } = generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      const deleteObjectStub = sinonSandbox.stub(mockS3Client, 'deleteObject').returns({
        promise: () =>
          Promise.resolve({
            DeleteMarker: true
          })
      } as AWS.Request<AWS.S3.DeleteObjectOutput, AWS.AWSError>);

      const result = await fileUtils.deleteFileFromS3('my-delete-key');

      expect(_getObjectStoreBucketNameStub).to.be.calledOnce;
      expect(deleteObjectStub).to.have.been.calledOnce;
      expect(deleteObjectStub).to.have.been.calledWith({
        Bucket: 'object-store-bucket-name',
        Key: 'my-delete-key'
      });
      expect(result).to.eql({ DeleteMarker: true });
    });

    it('throws an error when deleteObject rejects', async () => {
      sinonSandbox = sinon.createSandbox();
      generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      sinonSandbox.stub(mockS3Client, 'deleteObject').returns({
        promise: () =>
          Promise.reject({
            message: 'deleteObject test reject'
          })
      } as AWS.Request<AWS.S3.DeleteObjectOutput, AWS.AWSError>);

      try {
        await fileUtils.deleteFileFromS3('my-delete-key');
        expect.fail();
      } catch (actualError) {
        expect((actualError as AWS.AWSError).message).to.equal('deleteObject test reject');
      }
    });
  });

  describe('copyFileInS3', () => {
    it('copies a file', async () => {
      sinonSandbox = sinon.createSandbox();
      const { _getObjectStoreBucketNameStub } = generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      const copyObjectStub = sinonSandbox.stub(mockS3Client, 'copyObject').returns({
        promise: () =>
          Promise.resolve({
            CopyObjectResult: {
              LastModified: new Date('1970-01-01')
            }
          })
      } as AWS.Request<AWS.S3.CopyObjectOutput, AWS.AWSError>);

      const result = await fileUtils.copyFileInS3('old-key', 'new-key');

      expect(_getObjectStoreBucketNameStub).to.have.callCount(2);
      expect(copyObjectStub).to.have.been.calledOnce;
      expect(copyObjectStub).to.have.been.calledWith({
        Bucket: 'object-store-bucket-name',
        CopySource: '/object-store-bucket-name/old-key',
        Key: 'new-key'
      });
      expect(result).to.eql({
        CopyObjectResult: {
          LastModified: new Date('1970-01-01')
        }
      });
    });

    it('throws an error when copyObject rejects', async () => {
      sinonSandbox = sinon.createSandbox();
      generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      sinonSandbox.stub(mockS3Client, 'copyObject').returns({
        promise: () =>
          Promise.reject({
            message: 'copyObject test reject'
          })
      } as AWS.Request<AWS.S3.CopyObjectOutput, AWS.AWSError>);

      try {
        await fileUtils.copyFileInS3('old-key', 'new-key');
        expect.fail();
      } catch (actualError) {
        expect((actualError as AWS.AWSError).message).to.equal('copyObject test reject');
      }
    });
  });

  describe('uploadFileToS3', () => {
    const mockFile = {
      originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip',
      buffer: Buffer.from('helloworld'),
      mimetype: 'test-mimetype'
    } as unknown as Express.Multer.File;

    it('uploads a file', async () => {
      sinonSandbox = sinon.createSandbox();
      const { _getObjectStoreBucketNameStub } = generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      const uploadStub = sinonSandbox.stub(mockS3Client, 'upload').returns({
        promise: () =>
          Promise.resolve({
            Location: 'test-location',
            ETag: 'test-etag',
            Bucket: 'test-bucket',
            Key: 'test-key'
          })
      } as ManagedUpload);

      const result = await fileUtils.uploadFileToS3(mockFile, 'my-upload-key', { test_name: 'test_value' });

      expect(_getObjectStoreBucketNameStub).to.have.been.calledOnce;
      expect(uploadStub).to.have.been.calledOnce;
      expect(uploadStub).to.have.been.calledWith({
        Bucket: 'object-store-bucket-name',
        Body: Buffer.from('helloworld'),
        Key: 'my-upload-key',
        ContentType: 'test-mimetype',
        ACL: 'authenticated-read',
        Metadata: { test_name: 'test_value' }
      });
      expect(result).to.eql({
        Location: 'test-location',
        ETag: 'test-etag',
        Bucket: 'test-bucket',
        Key: 'test-key'
      });
    });

    it('throws an error when upload rejects', async () => {
      sinonSandbox = sinon.createSandbox();
      generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      sinonSandbox.stub(mockS3Client, 'upload').returns({
        promise: () => Promise.reject(new Error('upload test reject'))
      } as ManagedUpload);

      try {
        await fileUtils.uploadFileToS3(mockFile, 'my-upload-key');
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.eql('upload test reject');
      }
    });
  });

  describe('uploadBufferToS3', () => {
    const mockBuffer = Buffer.from('helloworld');

    it('uploads a buffer without metadata', async () => {
      sinonSandbox = sinon.createSandbox();
      const { _getObjectStoreBucketNameStub } = generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      const uploadStub = sinonSandbox.stub(mockS3Client, 'upload').returns({
        promise: () =>
          Promise.resolve({
            Location: 'test-location',
            ETag: 'test-etag',
            Bucket: 'test-bucket',
            Key: 'test-key'
          })
      } as ManagedUpload);

      const result = await fileUtils.uploadBufferToS3(mockBuffer, 'test-mimetype', 'my-upload-key');

      expect(_getObjectStoreBucketNameStub).to.have.been.calledOnce;
      expect(uploadStub).to.have.been.calledOnce;
      expect(uploadStub).to.have.been.calledWith({
        Bucket: 'object-store-bucket-name',
        Body: Buffer.from('helloworld'),
        ContentType: 'test-mimetype',
        Key: 'my-upload-key',
        ACL: 'authenticated-read',
        Metadata: {}
      });
      expect(result).to.eql({
        Location: 'test-location',
        ETag: 'test-etag',
        Bucket: 'test-bucket',
        Key: 'test-key'
      });
    });

    it('uploads a buffer with metadata', async () => {
      sinonSandbox = sinon.createSandbox();
      const { _getObjectStoreBucketNameStub } = generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      const uploadStub = sinonSandbox.stub(mockS3Client, 'upload').returns({
        promise: () =>
          Promise.resolve({
            Location: 'test-location',
            ETag: 'test-etag',
            Bucket: 'test-bucket',
            Key: 'test-key'
          })
      } as ManagedUpload);

      const result = await fileUtils.uploadBufferToS3(mockBuffer, 'test-mimetype', 'my-upload-key', {
        test_name: 'test_value'
      });

      expect(_getObjectStoreBucketNameStub).to.have.been.calledOnce;
      expect(uploadStub).to.have.been.calledOnce;
      expect(uploadStub).to.have.been.calledWith({
        Bucket: 'object-store-bucket-name',
        Body: Buffer.from('helloworld'),
        ContentType: 'test-mimetype',
        Key: 'my-upload-key',
        ACL: 'authenticated-read',
        Metadata: { test_name: 'test_value' }
      });
      expect(result).to.eql({
        Location: 'test-location',
        ETag: 'test-etag',
        Bucket: 'test-bucket',
        Key: 'test-key'
      });
    });

    it('throws an error when buffer upload rejects', async () => {
      sinonSandbox = sinon.createSandbox();
      generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      sinonSandbox.stub(mockS3Client, 'upload').returns({
        promise: () => Promise.reject(new Error('upload buffer test reject'))
      } as ManagedUpload);

      try {
        await fileUtils.uploadBufferToS3(mockBuffer, 'test-mimetype', 'my-upload-key', { test_name: 'test_value' });
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.eql('upload buffer test reject');
      }
    });
  });

  describe('getFileFromS3', () => {
    it('gets a file with a versionId', async () => {
      sinonSandbox = sinon.createSandbox();
      const { _getObjectStoreBucketNameStub } = generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      const getObjectStub = sinonSandbox.stub(mockS3Client, 'getObject').returns({
        promise: () =>
          Promise.resolve({
            Body: 'helloworld'
          })
      } as AWS.Request<AWS.S3.GetObjectOutput, AWS.AWSError>);

      const result = await fileUtils.getFileFromS3('my-get-key', 'my-version-id');

      expect(_getObjectStoreBucketNameStub).to.be.calledOnce;
      expect(getObjectStub).to.have.been.calledOnce;
      expect(getObjectStub).to.have.been.calledWith({
        Bucket: 'object-store-bucket-name',
        Key: 'my-get-key',
        VersionId: 'my-version-id'
      });
      expect(result).to.eql({ Body: 'helloworld' });
    });

    it('gets a file with no versionId', async () => {
      sinonSandbox = sinon.createSandbox();
      const { _getObjectStoreBucketNameStub } = generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      const getObjectStub = sinonSandbox.stub(mockS3Client, 'getObject').returns({
        promise: () =>
          Promise.resolve({
            Body: 'helloworld'
          })
      } as AWS.Request<AWS.S3.GetObjectOutput, AWS.AWSError>);

      const result = await fileUtils.getFileFromS3('my-get-key');

      expect(_getObjectStoreBucketNameStub).to.be.calledOnce;
      expect(getObjectStub).to.have.been.calledOnce;
      expect(getObjectStub).to.have.been.calledWith({
        Bucket: 'object-store-bucket-name',
        Key: 'my-get-key',
        VersionId: undefined
      });
      expect(result).to.eql({ Body: 'helloworld' });
    });

    it('throws an error when getObject rejects', async () => {
      sinonSandbox = sinon.createSandbox();
      generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      sinonSandbox.stub(mockS3Client, 'getObject').returns({
        promise: () =>
          Promise.reject({
            message: 'getObject test reject'
          })
      } as AWS.Request<AWS.S3.GetObjectOutput, AWS.AWSError>);

      try {
        await fileUtils.getFileFromS3('my-get-key');
        expect.fail();
      } catch (actualError) {
        expect((actualError as AWS.AWSError).message).to.equal('getObject test reject');
      }
    });
  });

  describe('getS3SignedURL', () => {
    it('returns null when no key specified', async () => {
      sinon.stub(fileUtils, '_getS3Client').returns(new AWS.S3());

      const result = await fileUtils.getS3SignedURL(null as unknown as string);

      expect(result).to.be.null;
    });

    it('returns null when s3Client is null', async () => {
      sinon.stub(fileUtils, '_getS3Client').returns(null as unknown as AWS.S3);

      const result = await fileUtils.getS3SignedURL('my-test-key');

      expect(result).to.be.null;
    });

    it('calls getSignedUrl', async () => {
      sinonSandbox = sinon.createSandbox();
      const { _getObjectStoreBucketNameStub } = generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      const getSignedUrlStub = sinonSandbox.stub(mockS3Client, 'getSignedUrl').returns('test-signed-url');

      const result = await fileUtils.getS3SignedURL('my-test-key');

      expect(_getObjectStoreBucketNameStub).to.be.calledOnce;
      expect(getSignedUrlStub).to.have.been.calledOnce;
      expect(getSignedUrlStub).to.have.been.calledWith('getObject', {
        Bucket: 'object-store-bucket-name',
        Key: 'my-test-key',
        Expires: 300000
      });
      expect(result).to.eql('test-signed-url');
    });

    it('generates a signed URL', async () => {
      sinonSandbox = sinon.createSandbox();
      const { _getObjectStoreBucketNameStub } = generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      const result = await fileUtils.getS3SignedURL('my-test-key');

      expect(_getObjectStoreBucketNameStub).to.be.calledOnce;
      expect(result).to.eql('https://s3.amazonaws.com/');
    });
  });

  describe('listFilesFromS3', () => {
    it('lists files from S3', async () => {
      sinonSandbox = sinon.createSandbox();
      const { _getObjectStoreBucketNameStub } = generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      const listObjectsStub = sinonSandbox.stub(mockS3Client, 'listObjects').returns({
        promise: () =>
          Promise.resolve({
            Contents: ['file1', 'file2']
          } as AWS.S3.ListObjectsOutput)
      } as AWS.Request<AWS.S3.ListObjectsOutput, AWS.AWSError>);

      const result = await fileUtils.listFilesFromS3('my-test-path');

      expect(_getObjectStoreBucketNameStub).to.be.calledOnce;
      expect(listObjectsStub).to.have.been.calledOnce;
      expect(listObjectsStub).to.have.been.calledWith({
        Bucket: 'object-store-bucket-name',
        Prefix: 'my-test-path'
      });
      expect(result).to.eql({
        Contents: ['file1', 'file2']
      });
    });

    it('throws an error when listObjects rejects', async () => {
      sinonSandbox = sinon.createSandbox();
      generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      sinonSandbox.stub(mockS3Client, 'listObjects').returns({
        promise: () =>
          Promise.reject({
            message: 'listObjects test reject'
          })
      } as AWS.Request<AWS.S3.ListObjectsOutput, AWS.AWSError>);

      try {
        await fileUtils.listFilesFromS3('my-testPath');
        expect.fail();
      } catch (actualError) {
        expect((actualError as AWS.AWSError).message).to.equal('listObjects test reject');
      }
    });
  });

  describe('getObjectMeta', () => {
    it('gets object metadata from S3', async () => {
      sinonSandbox = sinon.createSandbox();
      const { _getObjectStoreBucketNameStub } = generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      const getObjectMetaStub = sinonSandbox.stub(mockS3Client, 'headObject').returns({
        promise: () =>
          Promise.resolve({
            Metadata: {
              test_key1: 'test_value1',
              test_key2: 'test_value2'
            } as Metadata
          })
      } as AWS.Request<AWS.S3.HeadObjectOutput, AWS.AWSError>);

      const result = await fileUtils.getObjectMeta('my-get-meta-key');

      expect(_getObjectStoreBucketNameStub).to.be.calledOnce;
      expect(getObjectMetaStub).to.have.been.calledOnce;
      expect(getObjectMetaStub).to.have.been.calledWith({
        Bucket: 'object-store-bucket-name',
        Key: 'my-get-meta-key'
      });
      expect(result).to.eql({
        Metadata: {
          test_key1: 'test_value1',
          test_key2: 'test_value2'
        }
      });
    });

    it('throws an error when headObject rejects', async () => {
      sinonSandbox = sinon.createSandbox();
      generateStubs();
      const mockS3Client = new AWS.S3();

      sinonSandbox.stub(AWS, 'S3').returns(mockS3Client);

      sinonSandbox.stub(mockS3Client, 'headObject').returns({
        promise: () =>
          Promise.reject({
            message: 'headObject test reject'
          })
      } as AWS.Request<AWS.S3.HeadObjectOutput, AWS.AWSError>);

      try {
        await fileUtils.getObjectMeta('my-get-meta-key');
        expect.fail();
      } catch (actualError) {
        expect((actualError as AWS.AWSError).message).to.equal('headObject test reject');
      }
    });
  });

  describe('generateS3FileKey', () => {
    it('returns a basic file path', async () => {
      const result = fileUtils.generateS3FileKey({ submissionId: 1, fileName: 'testFileName' });

      expect(result).to.equal('platform/submissions/1/testFileName');
    });

    it('returns a basic file path without filename', async () => {
      const result = fileUtils.generateS3FileKey({ submissionId: 1 });

      expect(result).to.equal('platform/submissions/1');
    });

    it('returns a long file path', async () => {
      const result = fileUtils.generateS3FileKey({ submissionId: 1, fileName: 'extra/folders/testFileName' });

      expect(result).to.equal('platform/submissions/1/extra/folders/testFileName');
    });

    it('generates an artifact s3 key', () => {
      const result = fileUtils.generateS3FileKey({
        uuid: 'aaaa',
        artifactId: 33,
        fileName: 'bbbb.zip'
      });

      expect(result).to.equal('platform/artifacts/33/aaaa/DwCA/bbbb.zip');
    });

    it('generates an job queue s3 key', () => {
      const result = fileUtils.generateS3FileKey({
        uuid: 'aaaa',
        artifactId: 33,
        jobQueueId: 12,
        fileName: 'bbbb.zip'
      });

      expect(result).to.equal('platform/artifacts/33/aaaa/DwCA/12/bbbb.zip');
    });
  });

  describe('generateDatasetS3FileKey', () => {
    it('returns a dataset file path', async () => {
      const result = fileUtils.generateDatasetS3FileKey({ fileName: 'fileName', uuid: 'uuid', queueId: 1 });

      expect(result).to.equal('platform/datasets/uuid/dwca/1/fileName');
    });
  });

  describe('scanFileForVirus', () => {
    const mockFile = {
      originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip',
      buffer: 'test-buffer',
      mimetype: 'test-mimetype'
    } as unknown as Express.Multer.File;

    it('should return true if ClamAV scanner returns as null', async () => {
      sinon.stub(fileUtils, '_getClamAvScanner').returns(null);

      const result = await fileUtils.scanFileForVirus(mockFile);

      expect(result).to.equal(true);
    });

    it('should return false if ClamAV scanner detects a virus', async () => {
      process.env.ENABLE_FILE_VIRUS_SCAN = 'true';
      process.env.CLAMAV_HOST = 'mock.host';
      process.env.CLAMAV_PORT = '1000';

      sinonSandbox = sinon.createSandbox();

      const mockClamAvScanner = clamd.createScanner(process.env.CLAMAV_HOST, Number(process.env.CLAMAV_PORT));

      sinonSandbox.stub(clamd, 'createScanner').returns(mockClamAvScanner);

      const scanBufferStub = sinonSandbox.stub(mockClamAvScanner, 'scanBuffer').resolves('virus FOUND');

      const result = await fileUtils.scanFileForVirus(mockFile);

      expect(scanBufferStub).to.have.been.calledOnce;
      expect(scanBufferStub).to.have.been.calledWith('test-buffer', 3000, 1048576);
      expect(result).to.equal(false);
    });

    it('should return true if ClamAV scanner does not detect a virus', async () => {
      process.env.ENABLE_FILE_VIRUS_SCAN = 'true';
      process.env.CLAMAV_HOST = 'mock.host';
      process.env.CLAMAV_PORT = '1000';

      sinonSandbox = sinon.createSandbox();

      const mockClamAvScanner = clamd.createScanner(process.env.CLAMAV_HOST, Number(process.env.CLAMAV_PORT));

      sinonSandbox.stub(clamd, 'createScanner').returns(mockClamAvScanner);

      const scanBufferStub = sinonSandbox
        .stub(mockClamAvScanner, 'scanBuffer')
        .resolves('arbitrary scan result output');

      const result = await fileUtils.scanFileForVirus(mockFile);

      expect(scanBufferStub).to.have.been.calledOnce;
      expect(scanBufferStub).to.have.been.calledWith('test-buffer', 3000, 1048576);
      expect(result).to.equal(true);
    });
  });
});
