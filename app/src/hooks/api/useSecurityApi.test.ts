import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { secureDataAccessRequestFormInitialValues } from 'features/submissions/page/security/SecureDataAccessRequestForm';
import useSecurityApi from './useSecurityApi';

describe('useSecurityApi', () => {
  let mock: any;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('listPersecutionHarmRules', () => {
    it('works as expected', async () => {
      const response = [
        {
          persecution_or_harm_id: 1,
          persecution_or_harm_type_id: 1,
          wldtaxonomic_units_id: 1,
          name: 'name',
          description: null
        }
      ];

      mock.onGet('/api/security/persecution-harm/list').reply(200, response);

      const actualResult = await useSecurityApi(axios).listPersecutionHarmRules();
      expect(actualResult[0]).toEqual({
        persecution_or_harm_id: 1,
        persecution_or_harm_type_id: 1,
        wldtaxonomic_units_id: 1,
        name: 'name',
        description: null
      });
    });
  });

  describe('applySecurityReasonsToArtifacts', () => {
    it('works as expected', async () => {
      const response = [{ artifact_persecution_id: 1 }, { artifact_persecution_id: 2 }];

      mock.onPost('/api/security/persecution-harm/apply').reply(200, response);

      const actualResult = await useSecurityApi(axios).applySecurityReasonsToArtifacts([], []);
      expect(actualResult[0]).toEqual({ artifact_persecution_id: 1 });
      expect(actualResult[1]).toEqual({ artifact_persecution_id: 2 });
    });
  });

  describe('sendSecureArtifactAccessRequest', () => {
    it('works as expected', async () => {
      const response = true;

      mock.onPost('api/artifact/security/requestAccess').reply(200, response);

      const actualResult = await useSecurityApi(axios).sendSecureArtifactAccessRequest(
        secureDataAccessRequestFormInitialValues
      );
      expect(actualResult).toEqual(true);
    });
  });

  describe('getSecurityCategories', () => {
    it('requests paginated security categories with search params', async () => {
      const response = {
        categories: [{ security_category_id: 1, name: 'cat', description: 'desc', rule_count: 3 }],
        pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
      };

      mock.onGet('/api/administrative/security/categories').reply(200, response);

      const searchParams = { search: 'cat' };
      const pagination = { page: 1, limit: 10 };

      const actualResult = await useSecurityApi(axios).getSecurityCategories(searchParams, pagination);
      expect(actualResult).toEqual(response);

      expect(mock.history.get[0].params).toEqual({ ...searchParams, ...pagination });
    });
  });

  describe('getSecurityReasons', () => {
    it('requests paginated security reasons with search params', async () => {
      const response = {
        reasons: [{ security_rule_id: 1, name: 'reason', description: 'desc', feature_count: 2 }],
        pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
      };

      mock.onGet('/api/administrative/security/reasons').reply(200, response);

      const searchParams = { search: 'reason' };
      const pagination = { page: 1, limit: 10 };

      const actualResult = await useSecurityApi(axios).getSecurityReasons(searchParams, pagination);
      expect(actualResult).toEqual(response);

      expect(mock.history.get[0].params).toEqual({ ...searchParams, ...pagination });
    });
  });
});
