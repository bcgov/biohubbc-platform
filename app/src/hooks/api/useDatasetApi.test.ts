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

  it('listAllDatasets works as expected', async () => {
    const response = [
      {
        id: 'a6f90fb7-2f20-4d6e-b1cd-75f3336c2dcf',
        fields: {
          datasetTitle: ['Coastal Caribou']
        }
      }
    ];

    mock.onGet('api/dwc/eml/search').reply(200, response);

    const actualResult = await useDatasetApi(axios).listAllDatasets();

    expect(actualResult[0].id).toEqual('a6f90fb7-2f20-4d6e-b1cd-75f3336c2dcf');
    expect(actualResult[0].fields).toEqual({ datasetTitle: ['Coastal Caribou'] });
  });

  it('getDatasetEML works as expected', async () => {
    const response = 'response';

    mock.onGet('api/dwc/submission/a6f90fb7-2f20-4d6e-b1cd-75f3336c2dcf/get').reply(200, response);

    const actualResult = await useDatasetApi(axios).getDatasetEML('a6f90fb7-2f20-4d6e-b1cd-75f3336c2dcf');

    expect(actualResult).toEqual('response');
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

  it('getRelatedDatasets works as expected', async () => {
    mock.onGet(`api/dwc/submission/${'123-456-789'}/related`).reply(200, {
      datasets: [{ datasetId: '123' }, { datasetId: '456' }]
    });

    const actualResult = await useDatasetApi(axios).getRelatedDatasets('123-456-789');

    expect(actualResult).toEqual({
      datasets: [{ datasetId: '123' }, { datasetId: '456' }]
    });
  });

  it('getHandleBarsTemplateByDatasetId works as expected', async () => {
    mock.onGet(`api/dwc/submission/uuid/handlebar`).reply(200, {
      header: 'Header Template',
      details: 'Details Template'
    });

    const results = await useDatasetApi(axios).getHandleBarsTemplateByDatasetId('uuid');
    expect(results).toEqual({
      header: 'Header Template',
      details: 'Details Template'
    });
  });
});
