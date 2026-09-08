import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { IgcNotifyGenericMessage, IgcNotifyRecipient } from 'interfaces/useAdminApi.interface';
import useAdminApi from './useAdminApi';

describe('useAdminApi', () => {
  let mock: any;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  it('gets paginated submission features from the administrative endpoint', async () => {
    const mockResponse = {
      features: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
    };

    mock.onGet('/api/administrative/submission/1/features').reply(200, mockResponse);

    const result = await useAdminApi(axios).getSubmissionFeatures(1, { page: 1, limit: 10 });

    expect(result).toEqual(mockResponse);
    expect(mock.history.get[0].params).toEqual({ page: 1, limit: 10 });
  });

  it('gets a submission upload review', async () => {
    const submissionUploadId = '11111111-1111-4111-8111-111111111111';
    const reviewId = '22222222-2222-4222-8222-222222222222';
    const mockResponse = {
      submission_upload_review_id: reviewId,
      submission_upload_id: submissionUploadId,
      name: 'Validation pass',
      description: 'Check the uploaded features',
      scope: 'validation',
      status: 'in_progress',
      requested_by: 1
    };

    mock
      .onGet(`/api/administrative/submission/16/upload/${submissionUploadId}/review/${reviewId}`)
      .reply(200, mockResponse);

    await expect(useAdminApi(axios).getSubmissionUploadReview(16, submissionUploadId, reviewId)).resolves.toEqual(
      mockResponse
    );
  });

  it('gets cached reconciliation counts for a submission upload', async () => {
    const submissionUploadId = '11111111-1111-4111-8111-111111111111';
    const mockResponse = { new: 4, modified: 2, unmodified: 7 };

    mock
      .onGet(`/api/administrative/submission/16/upload/${submissionUploadId}/reconciliation`)
      .reply(200, mockResponse);

    await expect(useAdminApi(axios).getSubmissionUploadReconciliationCounts(16, submissionUploadId)).resolves.toEqual(
      mockResponse
    );
  });

  it('updates a submission upload review status', async () => {
    const submissionUploadId = '11111111-1111-4111-8111-111111111111';
    const reviewId = '22222222-2222-4222-8222-222222222222';
    const mockResponse = {
      submission_upload_review_id: reviewId,
      submission_upload_id: submissionUploadId,
      name: 'Validation pass',
      description: null,
      scope: 'validation',
      status: 'completed',
      requested_by: 1
    };

    mock
      .onPatch(`/api/administrative/submission/16/upload/${submissionUploadId}/review/${reviewId}`, {
        status: 'completed'
      })
      .reply(200, mockResponse);

    await expect(
      useAdminApi(axios).updateSubmissionUploadReview(16, submissionUploadId, reviewId, 'completed')
    ).resolves.toEqual(mockResponse);
  });

  it('gets paginated features for a submission upload', async () => {
    const submissionUploadId = '11111111-1111-4111-8111-111111111111';
    const mockResponse = {
      features: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 25 }
    };

    mock.onGet(`/api/administrative/submission/16/upload/${submissionUploadId}/features`).reply(200, mockResponse);

    const result = await useAdminApi(axios).getSubmissionUploadFeatures(16, submissionUploadId, {
      page: 1,
      limit: 25
    });

    expect(result).toEqual(mockResponse);
    expect(mock.history.get[0].params).toEqual({ page: 1, limit: 25 });
  });

  it('gets an unpublished feature belonging to a submission upload', async () => {
    const submissionUploadId = '11111111-1111-4111-8111-111111111111';
    const mockResponse = { feature: { submission_feature_id: 12 } };

    mock.onGet(`/api/administrative/submission/16/upload/${submissionUploadId}/features/12`).reply(200, mockResponse);

    await expect(useAdminApi(axios).getSubmissionUploadFeature(16, submissionUploadId, 12)).resolves.toEqual(
      mockResponse
    );
  });

  it('gets properties for an unpublished feature belonging to a submission upload', async () => {
    const submissionUploadId = '11111111-1111-4111-8111-111111111111';
    const mockResponse = {
      properties: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
    };

    mock
      .onGet(`/api/administrative/submission/16/upload/${submissionUploadId}/features/12/properties`)
      .reply(200, mockResponse);

    const result = await useAdminApi(axios).getSubmissionUploadFeatureProperties(16, submissionUploadId, 12, {
      page: 1,
      limit: 10,
      search: 'species'
    });

    expect(result).toEqual(mockResponse);
    expect(mock.history.get[0].params).toEqual({ page: 1, limit: 10, search: 'species' });
  });

  it('sendGCNotification works as expected', async () => {
    mock.onPost('/api/gcnotify/send').reply(200);

    const result = await useAdminApi(axios).sendGCNotification(
      { emailAddress: 'test@@email.com' } as IgcNotifyRecipient,
      { body: 'test' } as unknown as IgcNotifyGenericMessage
    );

    expect(result).toEqual(true);
  });

  it('addSystemUser works as expected', async () => {
    mock.onPost(`/api/user/add`).reply(200, true);

    const result = await useAdminApi(axios).addSystemUser('userIdentifier', 'userGuid', 'identitySource', 1);

    expect(result).toEqual(true);
  });
});
