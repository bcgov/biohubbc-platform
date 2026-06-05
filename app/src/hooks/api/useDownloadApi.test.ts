import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  CreateDownloadRequest,
  CreateDownloadResponse,
  DownloadDetail,
  DownloadListResponse
} from 'interfaces/useDownloadApi.interface';
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
            started_at: '2026-03-01T00:01:00Z',
            completed_at: '2026-03-01T00:02:00Z',
            downloaded_at: null,
            exports: []
          }
        ],
        pagination: { total: 1, current_page: 1, last_page: 1 }
      };

      mock.onGet('/api/download').reply(200, mockResponse);

      const result = await useDownloadApi(axios).getDownloads();

      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].url).toBe('/api/download');
    });

    it('should pass pagination params as query string', async () => {
      const mockResponse: DownloadListResponse = {
        downloads: [],
        pagination: { total: 0, current_page: 2, last_page: 3 }
      };

      mock.onGet('/api/download').reply(200, mockResponse);

      await useDownloadApi(axios).getDownloads({ page: 2, limit: 10 });

      expect(mock.history.get[0].params).toEqual({ page: 2, limit: 10 });
    });
  });

  describe('createDownload', () => {
    it('should POST payload to /api/download and return response', async () => {
      const mockRequest: CreateDownloadRequest = {
        name: 'Moose download',
        description: 'Moose observations in the Skeena',
        featureTypes: ['dataset'],
        expression: null
      };
      const mockResponse: CreateDownloadResponse = {
        download_id: '550e8400-e29b-41d4-a716-446655440099',
        download_url: 'https://localhost/api/download/550e8400-e29b-41d4-a716-446655440099'
      };

      mock.onPost('/api/download').reply(201, mockResponse);

      const result = await useDownloadApi(axios).createDownload(mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mock.history.post[0].url).toBe('/api/download');
      expect(JSON.parse(mock.history.post[0].data)).toEqual(mockRequest);
    });

    it('should propagate rejection on server error', async () => {
      const mockRequest: CreateDownloadRequest = {
        name: 'All datasets',
        featureTypes: ['dataset'],
        expression: null
      };

      mock.onPost('/api/download').reply(400, { message: 'Validation failed' });

      await expect(useDownloadApi(axios).createDownload(mockRequest)).rejects.toThrow();
    });
  });

  describe('getDownload', () => {
    it('should send GET to /api/download/<id> and return response', async () => {
      const downloadId = '550e8400-e29b-41d4-a716-446655440099';
      const mockResponse: DownloadDetail = {
        download_id: downloadId,
        status: 'ready',
        name: 'Moose download',
        description: 'Moose observations in the Skeena',
        started_at: '2026-03-01T00:01:00Z',
        completed_at: '2026-03-01T00:02:00Z',
        downloaded_at: null
      };

      mock.onGet(`/api/download/${downloadId}`).reply(200, mockResponse);

      const result = await useDownloadApi(axios).getDownload(downloadId);

      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].url).toBe(`/api/download/${downloadId}`);
    });

    it('should propagate rejection on 404', async () => {
      const downloadId = '550e8400-e29b-41d4-a716-446655440099';

      mock.onGet(`/api/download/${downloadId}`).reply(404, { message: 'Not found' });

      await expect(useDownloadApi(axios).getDownload(downloadId)).rejects.toThrow();
    });
  });
});
