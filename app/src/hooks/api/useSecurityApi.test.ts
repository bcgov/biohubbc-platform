import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import useSecurityApi from './useSecurityApi';
import { secureDataAccessRequestFormInitialValues } from 'features/datasets/security/SecureDataAccessRequestForm';

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
      })
    });
  });
  
  describe('applySecurityReasonsToArtifacts', () => {
    it('works as expected', async () => {
      const response = [
        { artifact_persecution_id: 1 },
        { artifact_persecution_id: 2 }
      ];
  
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
  
      const actualResult = await useSecurityApi(axios).sendSecureArtifactAccessRequest(secureDataAccessRequestFormInitialValues);
      expect(actualResult).toEqual(true)
    });
  })
});
