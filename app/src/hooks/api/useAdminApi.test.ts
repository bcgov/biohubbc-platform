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

  it('requests the upload-feature extent without creating a tile session', async () => {
    const response = { bbox: null, geometry_count: 0 };
    const signal = new AbortController().signal;
    mock.onGet('/api/administrative/submission/7/upload/upload-1/features/34/extent').reply(200, response);
    const result = await useAdminApi(axios).getSubmissionUploadFeatureGeometryExtent(7, 'upload-1', 34, { signal });
    expect(result).toEqual(response);
    expect(mock.history.get[0].signal).toBe(signal);
    expect(mock.history.post).toHaveLength(0);
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
    const submissionUploadReviewId = '22222222-2222-4222-8222-222222222222';
    const mockResponse = {
      submission_upload_review_id: submissionUploadReviewId,
      submission_upload_id: submissionUploadId,
      name: 'Validation pass',
      description: 'Check the uploaded features',
      scope: 'validation',
      status: 'in_progress',
      requested_by: 1
    };

    mock
      .onGet(`/api/administrative/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}`)
      .reply(200, mockResponse);

    await expect(
      useAdminApi(axios).getSubmissionUploadReview(16, submissionUploadId, submissionUploadReviewId)
    ).resolves.toEqual(mockResponse);
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
    const submissionUploadReviewId = '22222222-2222-4222-8222-222222222222';
    const mockResponse = {
      submission_upload_review_id: submissionUploadReviewId,
      submission_upload_id: submissionUploadId,
      name: 'Validation pass',
      description: null,
      scope: 'validation',
      status: 'completed',
      requested_by: 1
    };

    mock
      .onPatch(`/api/administrative/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}`, {
        status: 'completed'
      })
      .reply(200, mockResponse);

    await expect(
      useAdminApi(axios).updateSubmissionUploadReview(16, submissionUploadId, submissionUploadReviewId, 'completed')
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

  it('searches upload features with cursor pagination', async () => {
    const submissionUploadId = '11111111-1111-4111-8111-111111111111';
    const expression = {
      type: 'expression' as const,
      operator: 'AND' as const,
      clauses: [
        {
          type: 'predicate' as const,
          feature_property_id: 4,
          feature_type_property_id: null,
          operator: 'Contains' as const,
          value: 'moose'
        }
      ]
    };
    const mockResponse = {
      features: [],
      pagination: {
        limit: 10,
        sort: 'relevancy_score',
        order: 'desc',
        next_cursor: null,
        previous_cursor: null
      }
    };

    mock.onPost(`/api/administrative/submission/16/upload/${submissionUploadId}/features`).reply(200, mockResponse);

    const result = await useAdminApi(axios).searchSubmissionUploadFeatures(16, submissionUploadId, expression, {
      limit: 10
    });

    expect(result).toEqual(mockResponse);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      expression,
      pagination: { limit: 10 }
    });
  });

  it('counts upload feature expression results separately from cursor pagination', async () => {
    const submissionUploadId = '11111111-1111-4111-8111-111111111111';
    const expression = {
      type: 'expression' as const,
      operator: 'AND' as const,
      clauses: [
        {
          type: 'predicate' as const,
          feature_property_id: 4,
          feature_type_property_id: null,
          operator: 'Contains' as const,
          value: 'moose'
        }
      ]
    };
    mock.onPost(`/api/administrative/submission/16/upload/${submissionUploadId}/features/count`).reply(200, {
      total: 42
    });

    const result = await useAdminApi(axios).countSubmissionUploadFeatures(16, submissionUploadId, expression, {
      signal: new AbortController().signal
    });

    expect(result).toEqual({ total: 42 });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ expression });
  });

  it('requests the direct and inherited rules affecting one review feature', async () => {
    const submissionUploadId = '11111111-1111-4111-8111-111111111111';
    const submissionUploadReviewId = '22222222-2222-4222-8222-222222222222';
    const mockResponse = {
      rules: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
    };

    mock
      .onGet(
        `/api/administrative/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}/security/features/42/rules`
      )
      .reply(200, mockResponse);

    const result = await useAdminApi(axios).getSubmissionUploadReviewFeatureRules(
      16,
      submissionUploadId,
      submissionUploadReviewId,
      42,
      { page: 1, limit: 10 }
    );

    expect(result).toEqual(mockResponse);
    expect(mock.history.get[0].params).toEqual({ page: 1, limit: 10 });
  });

  it.each([[[]], [[10, 20]]])(
    'sends assignment search and commands through JSON bodies for selection %j',
    async (ids) => {
      const expression = { type: 'expression' as const, operator: 'AND' as const, clauses: [] };
      const root = '/api/administrative/submission/16/upload/upload-id/review/review-id/security';
      mock.onPost(`${root}/assignments`).reply(200, { rules: [], pagination: {} });
      mock.onPut(`${root}/rules/7/assignments`).reply(204);
      mock.onPost(`${root}/rules/7/assignments/remove`).reply(204);
      mock.onPost(`${root}/assignments/reset`).reply(204);
      const api = useAdminApi(axios);
      const pagination = { page: 2, limit: 10, sort: 'applied', order: 'desc' as const };
      await api.getSubmissionUploadReviewSelectedFeatureRules(
        16,
        'upload-id',
        'review-id',
        ids,
        { expression, keyword: 'private' },
        pagination
      );
      await api.insertSubmissionUploadReviewSecurityRuleAssignments(16, 'upload-id', 'review-id', ids, 7, expression);
      await api.deleteSubmissionUploadReviewSecurityRuleAssignments(16, 'upload-id', 'review-id', ids, 7, expression);
      await api.deleteSubmissionUploadReviewSecurityAssignments(16, 'upload-id', 'review-id', ids, expression);
      const scope = { submissionFeatureIds: ids, expression };
      expect(JSON.parse(mock.history.post[0].data)).toEqual({ ...scope, search: 'private', pagination });
      expect(JSON.parse(mock.history.put[0].data)).toEqual({ submissionFeatureIds: ids, expression });
      expect(JSON.parse(mock.history.post[1].data)).toEqual(scope);
      expect(JSON.parse(mock.history.post[2].data)).toEqual(scope);
      for (const request of [...mock.history.post, ...mock.history.put]) {
        expect(request.params).toBeUndefined();
        expect(request.paramsSerializer).toBeUndefined();
      }
      expect(mock.history.get).toHaveLength(0);
      expect(mock.history.delete).toHaveLength(0);
    }
  );

  it('sends empty feature IDs for whole-upload mutations and assignment search', async () => {
    const root = '/api/administrative/submission/16/upload/upload-id/review/review-id/security';
    mock.onPost().reply(200, { rules: [], pagination: {} });
    mock.onPut().reply(204);
    const api = useAdminApi(axios);
    await api.getSubmissionUploadReviewSelectedFeatureRules(
      16,
      'upload-id',
      'review-id',
      [],
      {},
      { page: 1, limit: 10 }
    );
    await api.insertSubmissionUploadReviewSecurityRuleAssignments(16, 'upload-id', 'review-id', [], 7);
    await api.deleteSubmissionUploadReviewSecurityRuleAssignments(16, 'upload-id', 'review-id', [], 7);
    await api.deleteSubmissionUploadReviewSecurityAssignments(16, 'upload-id', 'review-id', []);
    expect(mock.history.post[0].url).toEqual(`${root}/assignments`);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      submissionFeatureIds: [],
      pagination: { page: 1, limit: 10 }
    });
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ submissionFeatureIds: [] });
    expect(JSON.parse(mock.history.post[1].data)).toEqual({ submissionFeatureIds: [] });
    expect(JSON.parse(mock.history.post[2].data)).toEqual({ submissionFeatureIds: [] });
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
