import { expect } from 'chai';
import { describe } from 'mocha';
import { deleteFileFromS3, generateDatasetS3FileKey, generateS3FileKey, getS3SignedURL } from './file-utils';

describe('deleteFileFromS3', () => {
  it('returns null when no key specified', async () => {
    const result = await deleteFileFromS3(null as unknown as string);

    expect(result).to.be.null;
  });
});

describe('getS3SignedURL', () => {
  it('returns null when no key specified', async () => {
    const result = await getS3SignedURL(null as unknown as string);

    expect(result).to.be.null;
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
