import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  CreateExportPayload,
  DownloadExport,
  DownloadExportDetail,
  DownloadExportListResponse,
  DownloadFeatureType
} from 'interfaces/useDownloadExportApi.interface';
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
    // Minimal valid payload — the backend now REQUIRES a recipe + download_version_id, so there is
    // no empty-body path. Reused by the simple status/error-propagation tests below.
    const minimalPayload: CreateExportPayload = {
      download_version_id: 'ver-1',
      version: 1,
      export_type: 'csv',
      mode: 'per_feature_type',
      feature_types: ['telemetry'],
      merge_steps: []
    };

    it('POSTs the CreateExportPayload to /api/download/{id}/export', async () => {
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

      const result = await useDownloadExportApi(axios).createExport('abc-123', minimalPayload);

      expect(result).toEqual(mockResponse);
      expect(mock.history.post[0].url).toBe('/api/download/abc-123/export');
      expect(JSON.parse(mock.history.post[0].data)).toEqual(minimalPayload);
    });

    it('forwards a full per_feature_type CreateExportPayload as the POST body', async () => {
      // Verifies: createExport serializes the widened config payload verbatim into the POST body
      // (the hook no longer accepts the old `{ max_part_size_bytes }`-only shape).

      // Step 1: Build a fully-typed per_feature_type payload against the real interface.
      const payload: CreateExportPayload = {
        download_version_id: 'ver-1',
        version: 1,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: ['telemetry'],
        merge_steps: [],
        max_part_size_bytes: 1048576
      };

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

      // Step 2: Invoke the hook with the full payload.
      await useDownloadExportApi(axios).createExport('abc-123', payload);

      // Step 3: Assert the POST went to the right URL and forwarded the payload unchanged.
      expect(mock.history.post[0].url).toBe('/api/download/abc-123/export');
      expect(JSON.parse(mock.history.post[0].data)).toEqual(payload);
    });

    it('POSTs the widened denormalized config (root_feature_type, merge_steps, output_columns)', async () => {
      // Verifies: createExport forwards the full denormalized recipe — merge_steps and
      // output_columns survive serialization intact, not just the per_feature_type shape.

      // Step 1: Build a fully-typed denormalized payload against the real interface.
      const payload: CreateExportPayload = {
        download_version_id: 'ver-1',
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'animal',
        feature_types: ['animal', 'telemetry'],
        merge_steps: [
          {
            left_feature_type: 'animal',
            left_column: 'animal_id',
            right_feature_type: 'telemetry',
            right_column: 'animal_id',
            merge_type: 'left'
          }
        ],
        output_columns: [
          { feature_type: 'animal', column: 'animal_id' },
          { feature_type: 'telemetry', column: 'lat', output_column: 'latitude' }
        ],
        max_part_size_bytes: 1048576
      };

      const mockResponse: DownloadExport = {
        download_version_export_id: 'exp-2',
        download_id: 'abc-123',
        format: 'csv',
        mode: 'denormalized',
        status: 'pending',
        max_part_size_bytes: '1048576',
        part_count: 0,
        started_at: null,
        completed_at: null,
        error_message: null
      };

      mock.onPost('/api/download/abc-123/export').reply(200, mockResponse);

      // Step 2: Invoke the hook with the denormalized payload.
      await useDownloadExportApi(axios).createExport('abc-123', payload);

      // Step 3: Assert the parsed POST body equals the payload exactly.
      expect(JSON.parse(mock.history.post[0].data)).toEqual(payload);
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

      const result = await useDownloadExportApi(axios).createExport('abc-123', minimalPayload);

      expect(result.download_version_export_id).toBe('exp-1');
      expect(result.format).toBe('csv');
    });

    it('propagates HTTP 409 errors', async () => {
      mock.onPost('/api/download/abc-123/export').reply(409);

      await expect(useDownloadExportApi(axios).createExport('abc-123', minimalPayload)).rejects.toThrow();
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

  describe('getExports', () => {
    it('GETs the paginated /api/download/{downloadId}/export list path', async () => {
      const mockResponse: DownloadExportListResponse = {
        exports: [
          {
            download_version_export_id: 'ex-9',
            download_id: 'dl-1',
            format: 'csv',
            mode: 'per_feature_type',
            status: 'ready',
            max_part_size_bytes: '524288000',
            part_count: 1,
            started_at: '2026-04-22T00:00:00Z',
            completed_at: '2026-04-22T00:01:00Z',
            error_message: null
          }
        ],
        pagination: { total: 1, current_page: 1, last_page: 1 }
      };

      mock.onGet('/api/download/dl-1/export').reply(200, mockResponse);

      const result = await useDownloadExportApi(axios).getExports('dl-1', { page: 2, limit: 25 });

      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].url).toBe('/api/download/dl-1/export');
      expect(mock.history.get[0].params).toEqual({ page: 2, limit: 25 });
    });
  });

  describe('getDownloadFeatureTypes', () => {
    it('GETs /api/download/{downloadId}/feature-types and returns the typed feature types', async () => {
      // Verifies: getDownloadFeatureTypes targets the feature-types sub-resource of a download
      // and returns the typed DownloadFeatureType[] that drives the export config picker.

      // Step 1: Build a typed mock response against the real interface.
      const mockResponse: DownloadFeatureType[] = [
        { feature_type: 'animal', columns: ['animal_id', 'sex'] },
        { feature_type: 'telemetry', columns: ['lat', 'lon', 'timestamp'] }
      ];

      mock.onGet('/api/download/abc-123/feature-types').reply(200, mockResponse);

      // Step 2: Invoke the hook.
      const result = await useDownloadExportApi(axios).getDownloadFeatureTypes('abc-123');

      // Step 3: Assert the request URL and the returned payload.
      expect(mock.history.get[0].url).toBe('/api/download/abc-123/feature-types');
      expect(result).toEqual(mockResponse);
    });
  });
});
