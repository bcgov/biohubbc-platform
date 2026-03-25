import axios from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { uploadMultipartTar } from './submission-upload-utils';

describe('uploadMultipartTar', () => {
  it('uses backend part instructions to slice and upload chunks', async () => {
    const putSpy = vi.spyOn(axios, 'put').mockImplementation(async (_url, data) => {
      return {
        status: 200,
        statusText: 'OK',
        headers: { etag: `"etag-${(data as Uint8Array).length}"` }
      } as never;
    });

    const tarData = new Uint8Array(13);
    const presignedParts = [
      { partNumber: 2, url: 'https://example.com/p2', partSizeBytes: 5 },
      { partNumber: 1, url: 'https://example.com/p1', partSizeBytes: 5 },
      { partNumber: 3, url: 'https://example.com/p3', partSizeBytes: 3 }
    ];

    const result = await uploadMultipartTar(presignedParts, tarData, { concurrencyLimit: 2 });

    expect(putSpy).toHaveBeenCalledTimes(3);
    expect((putSpy.mock.calls[0]?.[1] as Uint8Array).length).toBe(5);
    expect((putSpy.mock.calls[1]?.[1] as Uint8Array).length).toBe(5);
    expect((putSpy.mock.calls[2]?.[1] as Uint8Array).length).toBe(3);
    expect(result.map((item) => item.PartNumber)).toEqual([1, 2, 3]);

    putSpy.mockRestore();
  });

  it('throws when backend part instructions do not match file size', async () => {
    const tarData = new Uint8Array(13);
    const presignedParts = [
      { partNumber: 1, url: 'https://example.com/p1', partSizeBytes: 5 },
      { partNumber: 2, url: 'https://example.com/p2', partSizeBytes: 5 },
      { partNumber: 3, url: 'https://example.com/p3', partSizeBytes: 5 }
    ];

    await expect(uploadMultipartTar(presignedParts, tarData)).rejects.toThrow(
      'Part instructions do not match file size.'
    );
  });
});
