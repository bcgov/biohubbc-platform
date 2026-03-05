import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { DownloadListResponse, FragmentUrlResponse } from 'interfaces/useDownloadApi.interface';
import { useDownloadApi } from './useDownloadApi';

describe('useDownloadApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('getDownloads', () => {
    it('should send GET to /api/download and return response', async () => {
      const mockResponse: DownloadListResponse = {
        downloads: [
          {
            download_id: 'abc-123',
            download_status: 'ready',
            create_date: '2026-03-01T00:00:00Z',
            feature_count: 42,
            total_fragments: 1,
            completed_fragments: 1,
            estimated_total_size_bytes: '1024',
            started_at: '2026-03-01T00:01:00Z',
            completed_at: '2026-03-01T00:02:00Z',
            downloaded_at: null
          }
        ]
      };

      mock.onGet('/api/download').reply(200, mockResponse);

      const result = await useDownloadApi(axios).getDownloads();

      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].url).toBe('/api/download');
    });
  });

  describe('getFragmentUrl', () => {
    it('should send GET to correct interpolated URL and return response', async () => {
      const mockResponse: FragmentUrlResponse = {
        url: 'https://s3.example.com/signed-url'
      };

      mock.onGet('/api/download/abc-123/fragment/0/url').reply(200, mockResponse);

      const result = await useDownloadApi(axios).getFragmentUrl('abc-123', 0);

      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].url).toBe('/api/download/abc-123/fragment/0/url');
    });

    it('should propagate API errors', async () => {
      mock.onGet('/api/download/abc-123/fragment/0/url').reply(500);

      await expect(useDownloadApi(axios).getFragmentUrl('abc-123', 0)).rejects.toThrow();
    });
  });
});
