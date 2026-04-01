import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useDatasetApi.interface';
import { SubmissionRecordWithSecurityAndRootFeature } from 'interfaces/useSubmissionsApi.interface';
import useSubmissionsApi from './useSubmissionsApi';

describe('useSubmissionApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('getSubmissionsForUser', () => {
    it('should return submissions for the current user', async () => {
      const mockSubmissions: SubmissionRecordWithSecurityAndRootFeature[] = [
        {
          submission_id: 1,
          uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          security_review_timestamp: null,
          publish_timestamp: null,
          submitted_timestamp: '2025-01-15T12:00:00.000Z',
          contributor_id: 10,
          name: 'Test submission',
          description: 'A description',
          comment: '',
          create_date: '2025-01-10T00:00:00.000Z',
          create_user: 10,
          update_date: null,
          update_user: null,
          revision_count: 0,
          security: SECURITY_APPLIED_STATUS.PENDING,
          root_feature_type_id: 3,
          root_feature_type_name: 'Species',
          regions: ['Region A']
        }
      ];

      mock.onGet('api/submission').reply(200, mockSubmissions);

      const result = await useSubmissionsApi(axios).getSubmissionsForUser();

      expect(result).toEqual(mockSubmissions);
    });

    it('should return an empty array when the user has no submissions', async () => {
      mock.onGet('api/submission').reply(200, []);

      const result = await useSubmissionsApi(axios).getSubmissionsForUser();

      expect(result).toEqual([]);
    });
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
