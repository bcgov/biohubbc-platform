import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { CreateDataRequestPayload, DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { useDataRequestApi } from './useDataRequestApi';

describe('useDataRequestApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('createDataRequest', () => {
    it('should POST payload to /api/data-request', async () => {
      const payload: CreateDataRequestPayload = {
        reason: 'Need this data',
        system_user_ids: [42],
        featureTypes: ['observation'],
        expression: {
          type: 'expression',
          operator: 'AND',
          clauses: []
        }
      };
      const mockResponse: DataRequestResponse = {
        data_request_id: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'Need this data',
        team_id: '550e8400-e29b-41d4-a716-446655440001',
        requested_by: 42,
        ticket_id: '550e8400-e29b-41d4-a716-446655440002',
        policy_id: '550e8400-e29b-41d4-a716-446655440003',
        status: PolicyStatus.REQUESTED,
        create_date: '2026-05-14T00:00:00Z'
      };

      mock.onPost('/api/data-request').reply(201, mockResponse);

      await useDataRequestApi(axios).createDataRequest(payload);

      expect(mock.history.post[0].url).toBe('/api/data-request');
      expect(JSON.parse(mock.history.post[0].data)).toEqual(payload);
    });

    it('should resolve with the response body', async () => {
      const payload: CreateDataRequestPayload = {
        reason: 'Need this data',
        system_user_ids: [42],
        featureTypes: ['observation'],
        expression: {
          type: 'expression',
          operator: 'AND',
          clauses: []
        }
      };
      const mockResponse: DataRequestResponse = {
        data_request_id: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'Need this data',
        team_id: '550e8400-e29b-41d4-a716-446655440001',
        requested_by: 42,
        ticket_id: '550e8400-e29b-41d4-a716-446655440002',
        policy_id: '550e8400-e29b-41d4-a716-446655440003',
        status: PolicyStatus.REQUESTED,
        create_date: '2026-05-14T00:00:00Z'
      };

      mock.onPost('/api/data-request').reply(201, mockResponse);

      const result = await useDataRequestApi(axios).createDataRequest(payload);

      expect(result).toEqual(mockResponse);
    });
  });
});
