import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Feature, FeatureCollection } from 'geojson';
import useSearchApi, { usePublicSearchApi } from './useSearchApi';

describe('useSearchApi', () => {
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

  it('getSpatialData with criteria `type` works as expected', async () => {
    const res = [{ type: 'FeatureCollection' } as FeatureCollection];

    mock.onGet('/api/dwc/spatial/search').reply(200, res);

    const result = await useSearchApi(axios).getSpatialData({
      boundary: { type: 'Feature' } as Feature,
      type: ['type']
    });

    expect(result[0]).toEqual({ type: 'FeatureCollection' });
  });

  it('getSpatialData with criteria `species` works as expected', async () => {
    const res = [{ species: 'Spotted Owl' }];

    mock.onGet('/api/dwc/spatial/search').reply(200, res);

    const result = await useSearchApi(axios).getSpatialData({
      boundary: { type: 'Feature' } as Feature,
      type: ['type'],
      species: ['species']
    });

    expect(result[0]).toEqual({ species: 'Spotted Owl' });
  });

  it('getSpatialFile works as expected', async () => {
    const res = 'zipped file contents';

    mock.onGet('/api/dwc/spatial/download').reply(200, res);

    const result = await useSearchApi(axios).getSpatialDataFile({
      boundary: { type: 'Feature' } as Feature,
      type: ['type'],
      datasetID: 'AAA-BBB'
    });

    expect(typeof result).toBe('string');
    expect(result).toEqual('zipped file contents');
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
