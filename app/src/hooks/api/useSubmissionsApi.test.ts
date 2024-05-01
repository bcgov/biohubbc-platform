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

  it('getSignedUrl works as expected', async () => {
    const res = 'test-signed-url';
    const testSubmissionId = 1;

    mock.onGet(`/api/dwc/submission/${testSubmissionId}/getSignedUrl`).reply(200, res);

    const result = await useSubmissionsApi(axios).getSignedUrl(testSubmissionId);

    expect(result).toEqual('test-signed-url');
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
