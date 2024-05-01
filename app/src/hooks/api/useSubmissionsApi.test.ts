import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import useSubmissionsApi from './useSubmissionsApi';

describe('useSubmissionApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('getSubmissionFeatureSignedUrl', () => {
    it('should return signed URL', async () => {
      const payload = {
        submissionId: 1,
        submissionFeatureId: 1,
        submissionFeatureValue: 'VALUE',
        submissionFeatureKey: 'KEY'
      };

      mock.onGet('/api/submission/1/features/1/signed-url?key=KEY&value=VALUE').reply(200, 'SIGNED_URL');

      const result = await useSubmissionsApi(axios).getSubmissionFeatureSignedUrl(payload);

      expect(result).toEqual('SIGNED_URL');
    });
  });
});
