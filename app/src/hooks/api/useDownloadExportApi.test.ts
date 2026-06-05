import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { DownloadExport, DownloadExportDetail } from 'interfaces/useDownloadExportApi.interface';
import { useDownloadExportApi } from './useDownloadExportApi';

describe('useDownloadExportApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('createExport', () => {
    it('POSTs to /api/download/{id}/export with empty body when payload omitted', async () => {
      const mockResponse: DownloadExport = {
        download_version_export_id: 'exp-1',
        download_id: 'abc-123',
        format: 'csv',
        mode: 'per_feature_type',
        status: 'pending',
        max_part_size_bytes: '524288000',
        part_count: 0,
        started_at: null,
        completed_at: null,
        error_message: null
      };

      mock.onPost('/api/download/abc-123/export').reply(200, mockResponse);

      const result = await useDownloadExportApi(axios).createExport('abc-123');

      expect(result).toEqual(mockResponse);
      expect(mock.history.post[0].url).toBe('/api/download/abc-123/export');
      expect(mock.history.post[0].data).toBe(JSON.stringify({}));
    });

    it('forwards the max_part_size_bytes payload', async () => {
      const mockResponse: DownloadExport = {
        download_version_export_id: 'exp-1',
        download_id: 'abc-123',
        format: 'csv',
        mode: 'per_feature_type',
        status: 'pending',
        max_part_size_bytes: '1048576',
        part_count: 0,
        started_at: null,
        completed_at: null,
        error_message: null
      };

      mock.onPost('/api/download/abc-123/export').reply(200, mockResponse);

      await useDownloadExportApi(axios).createExport('abc-123', { max_part_size_bytes: 1048576 });

      expect(mock.history.post[0].data).toBe(JSON.stringify({ max_part_size_bytes: 1048576 }));
    });

    it('returns a typed DownloadExport', async () => {
      const mockResponse: DownloadExport = {
        download_version_export_id: 'exp-1',
        download_id: 'abc-123',
        format: 'csv',
        mode: 'per_feature_type',
        status: 'pending',
        max_part_size_bytes: '524288000',
        part_count: 0,
        started_at: null,
        completed_at: null,
        error_message: null
      };

      mock.onPost('/api/download/abc-123/export').reply(200, mockResponse);

      const result = await useDownloadExportApi(axios).createExport('abc-123');

      expect(result.download_version_export_id).toBe('exp-1');
      expect(result.format).toBe('csv');
    });

    it('propagates HTTP 409 errors', async () => {
      mock.onPost('/api/download/abc-123/export').reply(409);

      await expect(useDownloadExportApi(axios).createExport('abc-123')).rejects.toThrow();
    });
  });

  describe('getExport', () => {
    it('GETs the nested /api/download/{downloadId}/export/{exportId} path', async () => {
      const mockResponse: DownloadExportDetail = {
        download_version_export_id: 'ex-9',
        download_id: 'dl-1',
        format: 'csv',
        mode: 'per_feature_type',
        status: 'ready',
        max_part_size_bytes: '524288000',
        part_count: 1,
        started_at: '2026-04-22T00:00:00Z',
        completed_at: '2026-04-22T00:01:00Z',
        error_message: null,
        parts: [{ chunk_id: 1, file_size_bytes: '1024', url: 'https://s3.example.com/signed-url' }]
      };

      mock.onGet('/api/download/dl-1/export/ex-9').reply(200, mockResponse);

      const result = await useDownloadExportApi(axios).getExport('dl-1', 'ex-9');

      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].url).toBe('/api/download/dl-1/export/ex-9');
    });

    it('returns detail including parts[]', async () => {
      const mockResponse: DownloadExportDetail = {
        download_version_export_id: 'ex-9',
        download_id: 'dl-1',
        format: 'csv',
        mode: 'per_feature_type',
        status: 'ready',
        max_part_size_bytes: '524288000',
        part_count: 2,
        started_at: '2026-04-22T00:00:00Z',
        completed_at: '2026-04-22T00:01:00Z',
        error_message: null,
        parts: [
          { chunk_id: 1, file_size_bytes: '1024', url: 'https://s3.example.com/p1' },
          { chunk_id: 2, file_size_bytes: '2048', url: 'https://s3.example.com/p2' }
        ]
      };

      mock.onGet('/api/download/dl-1/export/ex-9').reply(200, mockResponse);

      const result = await useDownloadExportApi(axios).getExport('dl-1', 'ex-9');

      expect(result.parts.length).toBe(2);
      expect(result.parts[0].chunk_id).toBe(1);
      expect(result.parts[1].url).toBe('https://s3.example.com/p2');
    });

    it('propagates HTTP 404 errors', async () => {
      mock.onGet('/api/download/dl-1/export/missing').reply(404);

      await expect(useDownloadExportApi(axios).getExport('dl-1', 'missing')).rejects.toThrow();
    });
  });
});
