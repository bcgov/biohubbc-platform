import {
  DeleteObjectCommand,
  DeleteObjectCommandOutput,
  DeleteObjectsCommand,
  DeleteObjectsCommandOutput,
  GetObjectCommand,
  GetObjectCommandOutput,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  ListObjectsCommand,
  ListObjectsCommandOutput,
  PutObjectCommand,
  PutObjectCommandOutput,
  S3Client
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';

export enum BucketType {
  MAIN = 'main',
  QUARANTINE = 'security'
}

interface BucketConfig {
  client: S3Client;
  name: string;
}

export class ObjectStorageService {
  buckets: Map<BucketType, BucketConfig>;

  constructor() {
    // Initialize bucket configurations
    this.buckets = new Map([
      [
        BucketType.MAIN,
        {
          client: new S3Client({
            endpoint: process.env.OBJECT_STORE_URL,
            credentials: {
              accessKeyId: process.env.OBJECT_STORE_ACCESS_KEY_ID!,
              secretAccessKey: process.env.OBJECT_STORE_SECRET_KEY_ID!
            },
            forcePathStyle: true,
            region: 'ca-central-1'
          }),
          name: process.env.OBJECT_STORE_BUCKET_NAME!
        }
      ],
      [
        BucketType.QUARANTINE,
        {
          client: new S3Client({
            endpoint: process.env.QUARANTINE_OBJECT_STORE_URL,
            credentials: {
              accessKeyId: process.env.QUARANTINE_OBJECT_STORE_ACCESS_KEY_ID!,
              secretAccessKey: process.env.QUARANTINE_OBJECT_STORE_SECRET_KEY_ID!
            },
            forcePathStyle: true,
            region: 'ca-central-1'
          }),
          name: process.env.QUARANTINE_OBJECT_STORE_BUCKET_NAME!
        }
      ]
    ]);
  }

  /**
   * Get bucket configuration by type
   *
   * @param {BucketType} type
   * @return {*}  {BucketConfig}
   * @memberof ObjectStorageService
   */
  private getBucket(type: BucketType): BucketConfig {
    const bucket = this.buckets.get(type);
    if (!bucket) {
      throw new Error(`Bucket type ${type} not configured`);
    }
    return bucket;
  }

  /**
   * Upload a file to the specified bucket
   *
   * @param {BucketType} bucketType
   * @param {Express.Multer.File} file
   * @param {string} key
   * @param {Record<string, string>} [metadata={}]
   * @return {*}  {Promise<PutObjectCommandOutput>}
   * @memberof ObjectStorageService
   */
  async uploadFile(
    bucketType: BucketType,
    file: Express.Multer.File,
    key: string,
    metadata: Record<string, string> = {}
  ): Promise<PutObjectCommandOutput> {
    const { client, name } = this.getBucket(bucketType);
    return client.send(
      new PutObjectCommand({
        Bucket: name,
        Body: file.buffer,
        ContentType: file.mimetype,
        Key: key,
        Metadata: metadata
      })
    );
  }

  /**
   * Upload a buffer to the specified bucket
   *
   * @param {BucketType} bucketType
   * @param {Buffer} buffer
   * @param {string} mimetype
   * @param {string} key
   * @param {Record<string, string>} [metadata={}]
   * @return {*}  {Promise<PutObjectCommandOutput>}
   * @memberof ObjectStorageService
   */
  async uploadBuffer(
    bucketType: BucketType,
    buffer: Buffer,
    mimetype: string,
    key: string,
    metadata: Record<string, string> = {}
  ): Promise<PutObjectCommandOutput> {
    const { client, name } = this.getBucket(bucketType);
    return client.send(
      new PutObjectCommand({
        Bucket: name,
        Body: buffer,
        ContentType: mimetype,
        Key: key,
        Metadata: metadata
      })
    );
  }

  /**
   * Upload a stream to the specified bucket
   *
   * @param {BucketType} bucketType
   * @param {Readable} stream
   * @param {string} mimetype
   * @param {string} key
   * @param {Record<string, string>} [metadata={}]
   * @return {*}  {Promise<void>}
   * @memberof ObjectStorageService
   */
  async uploadStream(
    bucketType: BucketType,
    stream: Readable,
    mimetype: string,
    key: string,
    metadata: Record<string, string> = {}
  ): Promise<void> {
    const { client, name } = this.getBucket(bucketType);
    const upload = new Upload({
      client,
      params: {
        Bucket: name,
        Key: key,
        Body: stream,
        ContentType: mimetype,
        Metadata: metadata
      }
    });

    await upload.done();
  }

  /**
   * Get a file from the specified bucket
   *
   * @param {BucketType} bucketType
   * @param {string} key
   * @param {string} [versionId]
   * @return {*}  {Promise<GetObjectCommandOutput>}
   * @memberof ObjectStorageService
   */
  async getFile(bucketType: BucketType, key: string, versionId?: string): Promise<GetObjectCommandOutput> {
    const { client, name } = this.getBucket(bucketType);
    return client.send(new GetObjectCommand({ Bucket: name, Key: key, VersionId: versionId }));
  }

  /**
   * Get a file from the specified bucket and return it as a readable stream.
   *
   * @param {BucketType} bucketType - The bucket to fetch the file from ('main' or 'security').
   * @param {string} key - The S3 object key.
   * @param {string} [versionId] - Optional S3 object version ID.
   * @return {Promise<Readable>} Resolves to a Node.js Readable stream for the file content.
   * @throws {Error} Throws if the object has no body.
   * @memberof ObjectStorageService
   */
  async getFileStream(bucketType: BucketType, key: string, versionId?: string): Promise<NodeJS.ReadableStream> {
    const s3Object = await this.getFile(bucketType, key, versionId);

    if (!s3Object.Body) {
      throw new Error('S3 object has no body');
    }

    // S3 Body can already be a stream (Node.js Readable)
    return s3Object.Body as NodeJS.ReadableStream;
  }

  /**
   * Delete a file from the specified bucket
   *
   * @param {BucketType} bucketType
   * @param {string} key
   * @return {*}  {Promise<DeleteObjectCommandOutput>}
   * @memberof ObjectStorageService
   */
  async deleteFile(bucketType: BucketType, key: string): Promise<DeleteObjectCommandOutput> {
    const { client, name } = this.getBucket(bucketType);
    return client.send(new DeleteObjectCommand({ Bucket: name, Key: key }));
  }

  /**
   * Delete multiple files from the specified bucket
   *
   * @param {BucketType} bucketType
   * @param {string[]} keys
   * @return {*}  {Promise<DeleteObjectsCommandOutput>}
   * @memberof ObjectStorageService
   */
  async bulkDeleteFiles(bucketType: BucketType, keys: string[]): Promise<DeleteObjectsCommandOutput> {
    if (!keys.length) {
      return {} as DeleteObjectsCommandOutput;
    }

    const { client, name } = this.getBucket(bucketType);
    return client.send(
      new DeleteObjectsCommand({
        Bucket: name,
        Delete: { Objects: keys.map((Key) => ({ Key })) }
      })
    );
  }

  /**
   * List files in the specified bucket with an optional prefix
   *
   * @param {BucketType} bucketType
   * @param {string} prefix
   * @return {*}  {Promise<ListObjectsCommandOutput>}
   * @memberof ObjectStorageService
   */
  async listFiles(bucketType: BucketType, prefix: string): Promise<ListObjectsCommandOutput> {
    const { client, name } = this.getBucket(bucketType);
    return client.send(new ListObjectsCommand({ Bucket: name, Prefix: prefix }));
  }

  /**
   * Get metadata for a file in the specified bucket
   *
   * @param {BucketType} bucketType
   * @param {string} key
   * @return {*}  {Promise<HeadObjectCommandOutput>}
   * @memberof ObjectStorageService
   */
  async getMetadata(bucketType: BucketType, key: string): Promise<HeadObjectCommandOutput> {
    const { client, name } = this.getBucket(bucketType);
    return client.send(new HeadObjectCommand({ Bucket: name, Key: key }));
  }

  /**
   * Generate a signed URL for a file in the specified bucket
   *
   * @param {BucketType} bucketType
   * @param {string} key
   * @param {number} [expiresInSeconds=300]
   * @return {*}  {Promise<string>}
   * @memberof ObjectStorageService
   */
  async getSignedUrl(bucketType: BucketType, key: string, expiresInSeconds = 300): Promise<string> {
    const { client, name } = this.getBucket(bucketType);
    return getSignedUrl(client, new GetObjectCommand({ Bucket: name, Key: key }), { expiresIn: expiresInSeconds });
  }

  /**
   * Generate signed URLs for multiple files in the specified bucket
   *
   * @param {BucketType} bucketType
   * @param {string[]} keys
   * @param {number} [expiresInSeconds=300]
   * @return {*}  {Promise<string[]>}
   * @memberof ObjectStorageService
   */
  async getSignedUrls(bucketType: BucketType, keys: string[], expiresInSeconds = 300): Promise<string[]> {
    return Promise.all(keys.map((key) => this.getSignedUrl(bucketType, key, expiresInSeconds)));
  }

  /**
   * Copy a file from one bucket to another
   *
   * @param {BucketType} sourceBucket
   * @param {BucketType} targetBucket
   * @param {string} key
   * @return {*}  {Promise<void>}
   * @memberof ObjectStorageService
   */
  async copyBetweenBuckets(sourceBucket: BucketType, targetBucket: BucketType, key: string): Promise<void> {
    // 1. Get the file from the source bucket
    const s3Object = await this.getFile(sourceBucket, key);
    const body = s3Object.Body as Readable;

    // 2. Get the target bucket client and name
    const { client, name } = this.getBucket(targetBucket);

    // 3. Upload using @aws-sdk/lib-storage Upload
    const upload = new Upload({
      client,
      params: {
        Bucket: name,
        Key: key,
        Body: body,
        ContentType: s3Object.ContentType || 'application/octet-stream',
        Metadata: s3Object.Metadata || {}
      }
    });

    // 4. Wait for the upload to complete
    await upload.done();
  }

  /**
   * Move a file from one bucket to another.
   *
   * NOTE: A background job will clean up the securityd bucket to delete old objects that have been copied to the main bucket
   *
   * @param {BucketType} sourceBucket
   * @param {BucketType} targetBucket
   * @param {string} key
   * @return {*}  {Promise<void>}
   * @memberof ObjectStorageService
   */
  async moveBetweenBuckets(sourceBucket: BucketType, targetBucket: BucketType, key: string): Promise<void> {
    await this.copyBetweenBuckets(sourceBucket, targetBucket, key);
  }

  /**
   * Copy a file from security bucket to main bucket
   *
   * @param {string} key
   * @return {*}  {Promise<{key: string}>}
   * @memberof ObjectStorageService
   */
  async promoteFromSecurity(key: string): Promise<{ key: string }> {
    await this.copyBetweenBuckets(BucketType.QUARANTINE, BucketType.MAIN, key);

    return { key };
  }
}
