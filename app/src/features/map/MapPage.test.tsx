import { FeatureCollection } from 'geojson';
import { createMemoryHistory } from 'history';
import { useApi } from 'hooks/useApi';
import { Router } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import MapPage from './MapPage';

jest.mock('../../hooks/useApi');

const mockBiohubApi = useApi as jest.Mock;

const mockUseApi = {
  search: {
    getSpatialData: jest.fn()
  }
};

const history = createMemoryHistory();

const renderContainer = () => {
  return render(
    <Router history={history}>
      <MapPage />
    </Router>
  );
};

jest.mock('../../components/map/components/SideSearchBar', () => () => <div></div>);

describe('MapPage', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows `Map` and map container when there are no occurrences', async () => {
    mockUseApi.search.getSpatialData.mockReturnValue([]);

    const { getByTestId } = renderContainer();

    await waitFor(() => {
      expect(getByTestId('MapContainer')).toBeVisible();
    });
  });

  it('shows `Map` and map container with data points when there is occurrences', async () => {
    const vaildFeatureCollection: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-129.083298513, 55.40257311]
          },
          properties: {
            type: 'Occurrence',
            eventDate: 'string'
          }
        }
      ]
    };

    mockUseApi.search.getSpatialData.mockReturnValue(vaildFeatureCollection);

    const { getByTestId } = renderContainer();

    await waitFor(() => {
      expect(getByTestId('MapContainer')).toBeVisible();
    });
  });
});
