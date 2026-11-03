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

  describe('getDataRequests', () => {
    it('should GET one page of data requests with the search and pagination', async () => {
      const mockResponse = {
        data_requests: [
          {
            data_request_id: 'request-1',
            reason: 'Need this data',
            status: PolicyStatus.REQUESTED,
            create_date: '2026-01-02',
            requested_by: 42,
            requested_by_name: 'Test User',
            ticket_id: 'ticket-1',
            policy_id: 'policy-1'
          }
        ],
        pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
      };

      mock.onGet('/api/administrative/data-requests').reply(200, mockResponse);

      const searchParams = { search: 'need' };
      const pagination = { page: 1, limit: 10 };

      const result = await useDataRequestApi(axios).getDataRequests(searchParams, pagination);

      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].params).toEqual({ ...searchParams, ...pagination });
    });
  });

  describe('getDataRequest', () => {
    it('should GET one data request by id', async () => {
      const mockResponse = {
        data_request_id: 'request-1',
        reason: 'Need this data',
        status: PolicyStatus.REQUESTED,
        create_date: '2026-01-02',
        requested_by: 42,
        requested_by_name: 'Test User',
        ticket_id: 'ticket-1',
        policy_id: 'policy-1'
      };

      mock.onGet('/api/administrative/data-requests/request-1').reply(200, mockResponse);

      const result = await useDataRequestApi(axios).getDataRequest('request-1');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getDataRequestFeatureTypes', () => {
    it('should GET the feature types a data request asks for', async () => {
      const mockResponse = { feature_types: [{ feature_type_name: 'observation', expression: null }] };

      mock.onGet('/api/administrative/data-requests/request-1/features/types').reply(200, mockResponse);

      const result = await useDataRequestApi(axios).getDataRequestFeatureTypes('request-1');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getDataRequestRecipients', () => {
    it('should GET the recipients of a data request', async () => {
      const mockResponse = {
        recipients: [{ system_user_id: 42, user_identifier: 'ruser', display_name: 'User, Robin', email: null }]
      };

      mock.onGet('/api/administrative/data-requests/request-1/recipients').reply(200, mockResponse);

      const result = await useDataRequestApi(axios).getDataRequestRecipients('request-1');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteDataRequestRecipient', () => {
    it('should DELETE the recipient from the data request', async () => {
      mock.onDelete('/api/administrative/data-requests/request-1/recipients/42').reply(204);

      await useDataRequestApi(axios).deleteDataRequestRecipient('request-1', 42);

      expect(mock.history.delete).toHaveLength(1);
    });
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
