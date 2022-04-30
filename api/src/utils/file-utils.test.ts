import { expect } from 'chai';
import { describe } from 'mocha';
import { deleteFileFromS3, generateS3FileKey, getS3SignedURL } from './file-utils';

describe('deleteFileFromS3', () => {
  it('returns null when no key specified', async () => {
    const result = await deleteFileFromS3((null as unknown) as string);

    expect(result).to.be.null;
  });
});

describe('getS3SignedURL', () => {
  it('returns null when no key specified', async () => {
    const result = await getS3SignedURL((null as unknown) as string);

    expect(result).to.be.null;
  });
});

describe('generateS3FileKey', () => {
  it('returns a basic file path', async () => {
    const result = generateS3FileKey({ fileName: 'testFileName' });

    expect(result).to.equal('platform/testFileName');
  });

  it('returns a long file path', async () => {
    const result = generateS3FileKey({ fileName: 'extra/folders/testFileName' });

    expect(result).to.equal('platform/extra/folders/testFileName');
  });

  it('returns file path with folder', async () => {
    const result = generateS3FileKey({ fileName: 'testFileName', folder: 'afolder' });

    expect(result).to.equal('platform/afolder/testFileName');
  });
});
