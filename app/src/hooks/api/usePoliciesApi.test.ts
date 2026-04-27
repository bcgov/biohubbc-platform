import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import usePoliciesApi from './usePoliciesApi';

describe('usePoliciesApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('getPolicies', () => {
    it('returns paginated policies', async () => {
      const mockResponse = {
        policies: [
          { policy_id: '1', name: 'Policy 1', description: null, status: PolicyStatus.APPROVED, statements: [] }
        ],
        pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
      };

      mock.onGet('/api/administrative/policies').reply(200, mockResponse);

      const result = await usePoliciesApi(axios).getPolicies();

      expect(result).toEqual(mockResponse);
    });

    it('passes query params', async () => {
      const mockResponse = {
        policies: [],
        pagination: { total: 0, current_page: 2, last_page: 1, per_page: 20 }
      };

      mock.onGet('/api/administrative/policies').reply(200, mockResponse);

      const result = await usePoliciesApi(axios).getPolicies(undefined, { page: 2, limit: 20 });

      expect(result.pagination.current_page).toEqual(2);
    });
  });

  describe('getPolicy', () => {
    it('returns a single policy with statements', async () => {
      const mockPolicy: IPolicy = {
        policy_id: '123',
        name: 'Test Policy',
        description: 'Test description',
        status: PolicyStatus.APPROVED,
        statements: [
          {
            policy_statement_id: 's1',
            policy_id: '123',
            effect: 'allow',
            submission_feature_urn: 'urn:*:*:*',
            conditions: []
          }
        ]
      };

      mock.onGet('/api/administrative/policies/123').reply(200, mockPolicy);

      const result = await usePoliciesApi(axios).getPolicy('123');

      expect(result).toEqual(mockPolicy);
    });
  });

  describe('createPolicy', () => {
    it('creates a new policy', async () => {
      const newPolicy = {
        name: 'New Policy',
        description: 'New description',
        statements: [{ effect: 'allow' as const, submission_feature_urn: 'urn:*:*:*' }]
      };

      const mockResponse: IPolicy = {
        policy_id: '456',
        name: 'New Policy',
        description: 'New description',
        status: PolicyStatus.APPROVED,
        statements: []
      };

      mock.onPost('/api/administrative/policies').reply(200, mockResponse);

      const result = await usePoliciesApi(axios).createPolicy(newPolicy);

      expect(result.policy_id).toEqual('456');
    });
  });

  describe('updatePolicy', () => {
    it('updates an existing policy', async () => {
      const updateData = {
        name: 'Updated Policy',
        status: PolicyStatus.APPROVED,
        statements: []
      };

      const mockResponse: IPolicy = {
        policy_id: '123',
        name: 'Updated Policy',
        description: null,
        status: PolicyStatus.APPROVED,
        statements: []
      };

      mock.onPut('/api/administrative/policies/123').reply(200, mockResponse);

      const result = await usePoliciesApi(axios).updatePolicy('123', updateData);

      expect(result.name).toEqual('Updated Policy');
    });
  });

  describe('deletePolicy', () => {
    it('deletes a policy', async () => {
      mock.onDelete('/api/administrative/policies/123').reply(204);

      await expect(usePoliciesApi(axios).deletePolicy('123')).resolves.toBeUndefined();
    });
  });
});
