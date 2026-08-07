import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useArtifactApi.interface';
import { IGetSubmissionsForUserResponse, SubmissionSummary } from 'interfaces/useSubmissionsApi.interface';
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
      const mockSubmissions: SubmissionSummary[] = [
        {
          submission_id: 1,
          uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          publish_timestamp: null,
          submitted_timestamp: '2025-01-15T12:00:00.000Z',
          system_user_id: 42,
          contributor_id: 10,
          name: 'Test submission',
          description: 'A description',
          comment: '',
          create_user: 10,
          update_user: null,
          security: SECURITY_APPLIED_STATUS.PENDING,
          regions: ['Region A']
        }
      ];

      const mockResponse: IGetSubmissionsForUserResponse = {
        submissions: mockSubmissions,
        pagination: {
          total: 1,
          current_page: 1,
          last_page: 1,
          per_page: 10,
          sort: 'submitted_timestamp',
          order: 'desc'
        }
      };

      mock.onGet('api/submission').reply(200, mockResponse);

      const result = await useSubmissionsApi(axios).getSubmissionsForUser();

      expect(result).toEqual(mockResponse);
    });

    it('should return an empty array when the user has no submissions', async () => {
      const mockResponse: IGetSubmissionsForUserResponse = {
        submissions: [],
        pagination: {
          total: 0,
          current_page: 1,
          last_page: 1,
          per_page: 10
        }
      };

      mock.onGet('api/submission').reply(200, mockResponse);

      const result = await useSubmissionsApi(axios).getSubmissionsForUser();

      expect(result).toEqual(mockResponse);
    });
  });
});
