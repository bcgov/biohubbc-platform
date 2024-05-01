import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import useDatasetApi from './useDatasetApi';

describe('useDatasetApi', () => {
  let mock: any;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  it('getDatasetArtifacts works as expected', async () => {
    const response = {
      artifacts: [{ artifact_id: 1 }, { artifact_id: 2 }]
    };

    mock.onGet('api/dwc/submission/a6f90fb7-2f20-4d6e-b1cd-75f3336c2dcf/artifacts').reply(200, response);

    const actualResult = await useDatasetApi(axios).getDatasetArtifacts('a6f90fb7-2f20-4d6e-b1cd-75f3336c2dcf');

    expect(actualResult).toEqual({
      artifacts: [{ artifact_id: 1 }, { artifact_id: 2 }]
    });
  });

  it('getArtifactSignedUrl works as expected', async () => {
    mock.onGet(`api/artifact/${1}/getSignedUrl`).reply(200, 'http://example.com');

    const actualResult = await useDatasetApi(axios).getArtifactSignedUrl(1);

    expect(actualResult).toEqual('http://example.com');
  });
});
