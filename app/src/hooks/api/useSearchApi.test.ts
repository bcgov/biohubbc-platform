import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import useSearchApi, { usePublicSearchApi } from './useSearchApi';

describe.only('useSearchApi', () => {
  let mock: any;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  it('getSearchResults works as expected', async () => {
    const res = [
      {
        id: '1',
        name: 'name',
        objectives: 'objectives',
        geometry: []
      }
    ];

    mock.onGet('api/search').reply(200, res);

    const result = await useSearchApi(axios).getSearchResults();

    expect(result[0].id).toEqual('1');
  });

  it('listAllDatasets works as expected', async () => {
    const response = [
      {
        id: 'a6f90fb7-2f20-4d6e-b1cd-75f3336c2dcf',
        fields: {
          datasetTitle: ["Coastal Caribou"]
        }
      }
    ];

    mock.onGet('api/dwc/eml/search').reply(200, response);

    const actualResult = await useSearchApi(axios).listAllDatasets();

    expect(actualResult[0].id).toEqual('a6f90fb7-2f20-4d6e-b1cd-75f3336c2dcf');
    expect(actualResult[0].fields).toEqual({ datasetTitle: ["Coastal Caribou"] });
  });

  it('getMapOccurrenceData works as expected', async () => {
    const res = [
      {
        id: '1',
        taxonid: 'name',
        geometry: 'geometry',
        observations: []
      }
    ];

    mock.onGet('/api/dwc/submission/occurrence/list').reply(200, res);

    const result = await useSearchApi(axios).getMapOccurrenceData();

    expect(result[0].id).toEqual('1');
  });
});

describe('usePublicSearchApi', () => {
  let mock: any;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  it('getSearchResults works as expected', async () => {
    const res = [
      {
        id: '1',
        name: 'name',
        objectives: 'objectives',
        geometry: []
      }
    ];

    mock.onGet('api/public/search').reply(200, res);

    const result = await usePublicSearchApi(axios).getSearchResults();

    expect(result[0].id).toEqual('1');
  });
});
