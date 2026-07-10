import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { GalleryDownloadsResponse } from 'interfaces/useGalleryApi.interface';
import { useGalleryApi } from './useGalleryApi';

describe('useGalleryApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('getGalleryDownloadsBySlug', () => {
    it('should send GET to /api/gallery/slug/<slug>/download and return response', async () => {
      const mockResponse: GalleryDownloadsResponse = {
        downloads: [
          {
            download_id: 'abc-123',
            download_version_id: 'ver-abc-123',
            download_status: 'ready',
            format: 'parquet',
            metadata: null,
            started_at: '2026-03-01T00:01:00Z',
            completed_at: '2026-03-01T00:02:00Z',
            downloaded_at: null,
            create_date: '2026-03-01T00:00:00Z',
            name: 'Moose download',
            description: 'Moose observations in the Skeena',
            feature_count: 17412
          }
        ],
        pagination: { total: 1, current_page: 1, last_page: 1 }
      };

      mock.onGet('/api/gallery/slug/my-gallery/download').reply(200, mockResponse);

      const result = await useGalleryApi(axios).getGalleryDownloadsBySlug('my-gallery');

      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].url).toBe('/api/gallery/slug/my-gallery/download');
    });

    it('should pass pagination params as query string', async () => {
      const mockResponse: GalleryDownloadsResponse = {
        downloads: [],
        pagination: { total: 0, current_page: 2, last_page: 3 }
      };

      mock.onGet('/api/gallery/slug/home/download').reply(200, mockResponse);

      await useGalleryApi(axios).getGalleryDownloadsBySlug('home', { page: 2, limit: 9 });

      expect(mock.history.get[0].params).toEqual({ page: 2, limit: 9 });
    });

    it('should propagate rejection on 404', async () => {
      mock.onGet('/api/gallery/slug/home/download').reply(404, { message: 'Not found' });

      await expect(useGalleryApi(axios).getGalleryDownloadsBySlug('home')).rejects.toThrow();
    });
  });
});
