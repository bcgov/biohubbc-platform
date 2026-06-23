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
          {
            policy_id: '1',
            name: 'Policy 1',
            description: null,
            status: PolicyStatus.APPROVED,
            statements: [],
            expressions: []
          }
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
        expressions: [],
        statements: [
          {
            policy_statement_id: 's1',
            policy_id: '123',
            effect: 'allow',
            submission_feature_urn: 'urn:*:*:*',
            policy_expression_id: null
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
        expressions: [],
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
        expressions: [],
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

  describe('createPolicyExpression', () => {
    it('creates a policy expression', async () => {
      const expression = {
        type: 'expression' as const,
        operator: 'AND' as const,
        clauses: [
          {
            type: 'predicate' as const,
            feature_property_id: 1,
            feature_type_property_id: null,
            operator: 'Equals' as const,
            value: 'sensitive'
          }
        ]
      };
      const mockResponse = {
        policy_expression_id: 'pe-1',
        policy_id: '123',
        expression_id: 'expr-1',
        name: 'Sensitive species',
        description: 'Filters sensitive species observations',
        expression
      };

      mock.onPost('/api/administrative/policies/123/expressions').reply(201, mockResponse);

      const result = await usePoliciesApi(axios).createPolicyExpression('123', {
        name: 'Sensitive species',
        description: 'Filters sensitive species observations',
        expression
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('updatePolicyExpression', () => {
    it('updates a policy expression', async () => {
      const expression = {
        type: 'expression' as const,
        operator: 'AND' as const,
        clauses: [
          {
            type: 'predicate' as const,
            feature_property_id: 1,
            feature_type_property_id: null,
            operator: 'Equals' as const,
            value: 'updated'
          }
        ]
      };
      const mockResponse = {
        policy_expression_id: 'pe-1',
        policy_id: '123',
        expression_id: 'expr-2',
        name: 'Updated sensitive species',
        description: 'Updated filters',
        expression
      };

      mock.onPut('/api/administrative/policies/123/expressions/pe-1').reply(200, mockResponse);

      const result = await usePoliciesApi(axios).updatePolicyExpression('123', 'pe-1', {
        name: 'Updated sensitive species',
        description: 'Updated filters',
        expression
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('deletePolicyExpression', () => {
    it('deletes a policy expression', async () => {
      mock.onDelete('/api/administrative/policies/123/expressions/pe-1').reply(204);

      await expect(usePoliciesApi(axios).deletePolicyExpression('123', 'pe-1')).resolves.toBeUndefined();
    });
  });

  describe('getPolicyExpressions', () => {
    it('returns paginated policy expressions', async () => {
      const expression = {
        type: 'expression' as const,
        operator: 'AND' as const,
        clauses: [
          {
            type: 'predicate' as const,
            feature_property_id: 1,
            feature_type_property_id: null,
            operator: 'Equals' as const,
            value: 'sensitive'
          }
        ]
      };
      const mockResponse = {
        expressions: [
          {
            policy_expression_id: 'pe-1',
            policy_id: '123',
            expression_id: 'expr-1',
            name: 'Sensitive species',
            description: 'Filters sensitive species observations',
            expression
          }
        ],
        pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10, sort: 'name', order: 'asc' }
      };

      mock
        .onGet('/api/administrative/policies/123/expressions', { params: { page: 1, limit: 10 } })
        .reply(200, mockResponse);

      const result = await usePoliciesApi(axios).getPolicyExpressions('123', { page: 1, limit: 10 });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getPolicyTeams', () => {
    it('returns paginated policy teams', async () => {
      const mockResponse = {
        teams: [
          {
            team_policy_id: 'team-policy-1',
            team_id: 'team-1',
            policy_id: '123',
            team_name: 'Team Alpha',
            policy_name: 'Policy 1'
          }
        ],
        pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10, sort: 'team_name', order: 'asc' }
      };

      mock
        .onGet('/api/administrative/policies/123/teams', {
          params: { page: 1, limit: 10, sort: 'team_name', order: 'asc' }
        })
        .reply(200, mockResponse);

      const result = await usePoliciesApi(axios).getPolicyTeams('123', {
        page: 1,
        limit: 10,
        sort: 'team_name',
        order: 'asc'
      });

      expect(result).toEqual(mockResponse);
    });
  });
});
