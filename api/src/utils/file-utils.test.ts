import AWS from 'aws-sdk';
import { expect } from 'chai';
import sinon from 'sinon';
import { describe } from 'mocha';
import {
  deleteFileFromS3,
  generateDatasetS3FileKey,
  generateS3FileKey,
  getS3HostUrl,
  getS3SignedURL,
  _getClamAvScanner,
  _getObjectStoreBucketName,
  _getObjectStoreUrl,
  _getS3Client,
  _getS3KeyPrefix
} from './file-utils';

const generateStubs = () => {
  const _getObjectStoreUrlMock = sinon
    .stub(_getObjectStoreUrl.prototype)
    .returns('object.store.url');

  const _getObjectStoreBucketNameMock = sinon
    .stub(_getObjectStoreBucketName.prototype)
    .returns('object-store-bucket-name');

  const _getS3KeyPrefixMock = sinon
    .stub(_getS3KeyPrefix.prototype)
    .returns('platform-test');
  
  return {
    _getObjectStoreUrlMock,
    _getObjectStoreBucketNameMock,
    _getS3KeyPrefixMock
  }
}

describe.only('file-utils', () => {
  beforeEach(() => {
    process.env.OBJECT_STORE_ACCESS_KEY_ID = 'object-store-access-key-id';
    process.env.OBJECT_STORE_SECRET_KEY_ID = 'object-store-secret-key-id';
  });

  afterEach(() => {
    sinon.restore();
  });

  describe.only('_getS3Client', () => {
    beforeEach(() => {
      generateStubs();
    });

    it('should return an S3 client', () => {
      const result = _getS3Client();
      expect(result).to.be.instanceOf(AWS.S3);
    });

    it('constructs an S3 client', async () => {
      const s3Stub = sinon.stub(AWS, 'S3').returns({});

      expect(s3Stub).to.have.been.calledWith({
        endpoint: 'http://object.store.url',
        accessKeyId: 'object-store-access-key-id',
        secretAccessKey: 'object-store-secret-key-id',
        signatureVersion: 'v4',
        s3ForcePathStyle: true,
        region: 'ca-central-1'
      });
    })
  });

  describe('_getClamAvScanner', () => {
    it('should return a clamAv scanner client', () => {
      process.env.ENABLE_FILE_VIRUS_SCAN = 'true';
      process.env.CLAMAV_HOST = 'host';
      process.env.CLAMAV_PORT = '1111';

      const result = _getClamAvScanner();
      expect(result).to.not.be.null;
    });

    it('should return null if enable file virus scan is not set to true', () => {
      process.env.ENABLE_FILE_VIRUS_SCAN = 'false';
      process.env.CLAMAV_HOST = 'host';
      process.env.CLAMAV_PORT = '1111';

      const result = _getClamAvScanner();
      expect(result).to.be.null;
    });

    it('should return null if CLAMAV_HOST is not set', () => {
      process.env.ENABLE_FILE_VIRUS_SCAN = 'true';
      delete process.env.CLAMAV_HOST;
      process.env.CLAMAV_PORT = '1111';

      const result = _getClamAvScanner();
      expect(result).to.be.null;
    });

    it('should return null if CLAMAV_PORT is not set', () => {
      process.env.ENABLE_FILE_VIRUS_SCAN = 'true';
      process.env.CLAMAV_HOST = 'host';
      delete process.env.CLAMAV_PORT;

      const result = _getClamAvScanner();
      expect(result).to.be.null;
    });
  });

  describe('_getObjectStoreBucketName', () => {
    it('should return an object store bucket name', () => {
      process.env.OBJECT_STORE_BUCKET_NAME = 'test-bucket1';

      const result = _getObjectStoreBucketName();
      expect(result).to.equal('test-bucket1');
    });

    it('should return its default value', () => {
      delete process.env.OBJECT_STORE_BUCKET_NAME;

      const result = _getObjectStoreBucketName();
      expect(result).to.equal('');
    });
  });

  describe('_getObjectStoreUrl', () => {
    it('should return an object store bucket name', () => {
      process.env.OBJECT_STORE_URL = 'test-url1';

      const result = _getObjectStoreUrl();
      expect(result).to.equal('test-url1');
    });

    it('should return its default value', () => {
      delete process.env.OBJECT_STORE_URL;

      const result = _getObjectStoreUrl();
      expect(result).to.equal('nrs.objectstore.gov.bc.ca');
    });
  });

  describe('deleteFileFromS3', () => {
    it('returns null when no key specified', async () => {
      const result = await deleteFileFromS3(null as unknown as string);

      expect(result).to.be.null;
    });

    it('deletes a file', async () => {
      //
    });
  });

  describe('getS3SignedURL', () => {
    it('returns null when no key specified', async () => {
      const result = await getS3SignedURL(null as unknown as string);

      expect(result).to.be.null;
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

      const result = getS3HostUrl();

      expect(result).to.equal('nrs.objectstore.gov.bc.ca');
    });

    it('should successfully produce an S3 host url', () => {
      const result = getS3HostUrl();

      expect(result).to.equal('s3.host.example.com/test-bucket-name');
    });

    it('should successfully append a key to an S3 host url', () => {
      const result = getS3HostUrl('my-test-file.txt');

      expect(result).to.equal('s3.host.example.com/test-bucket-name/my-test-file.txt');
    });
  });

  describe('generateS3FileKey', () => {
    it('returns a basic file path', async () => {
      const result = generateS3FileKey({ submissionId: 1, fileName: 'testFileName' });

      expect(result).to.equal('platform/submissions/1/testFileName');
    });

    it('returns a long file path', async () => {
      const result = generateS3FileKey({ submissionId: 1, fileName: 'extra/folders/testFileName' });

      expect(result).to.equal('platform/submissions/1/extra/folders/testFileName');
    });

    it('generates an artifact s3 key', () => {
      const result = generateS3FileKey({
        uuid: 'aaaa',
        artifactId: 33,
        fileName: 'bbbb.zip'
      });

      expect(result).to.equal('platform/artifacts/33/aaaa/DwCA/bbbb.zip');
    });
  });

  describe('generateDatasetS3FileKey', () => {
    it('returns a dataset file path', async () => {
      const result = generateDatasetS3FileKey({ fileName: 'fileName', uuid: 'uuid', queueId: 1 });

      expect(result).to.equal('platform/datasets/uuid/dwca/1/fileName');
    });
  });
});
