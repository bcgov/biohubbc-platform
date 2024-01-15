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

  it('listSubmissions works as expected', async () => {
    const res = [
      {
        create_date: '2022-05-24T18:41:42.056Z',
        create_user: 15,
        darwin_core_source: {},
        delete_timestamp: null,
        eml_source: null,
        event_timestamp: '2022-05-24T18:41:42.211Z',
        input_file_name: 'moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
        input_key: 'biohub/1/moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
        revision_count: 1,
        source: 'SIMS',
        submission_id: 1,
        submission_status: null,
        update_date: '2022-05-24T18:41:42.056Z',
        update_user: 15,
        uuid: '2267501d-c6a9-43b5-b951-2324faff6397'
      }
    ];

    mock.onGet('/api/dwc/submission/list').reply(200, res);

    const result = await useSubmissionsApi(axios).listSubmissions();

    expect(result[0].submission_id).toEqual(1);
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
