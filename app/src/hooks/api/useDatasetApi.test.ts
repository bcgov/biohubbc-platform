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
});
