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
