import { cleanup, render, waitFor } from '@testing-library/react';
import { FeatureCollection } from 'geojson';
import { createMemoryHistory } from 'history';
import { useApi } from 'hooks/useApi';
import React from 'react';
import { Router } from 'react-router';
import MapPage from './MapPage';

jest.mock('../../hooks/useApi');
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

const mockBiohubApi = (useApi as unknown as jest.Mock<typeof mockUseApi>).mockReturnValue(mockUseApi);

describe('MapPage', () => {
  beforeEach(() => {
    // clear mocks before each test
    mockBiohubApi().search.getSpatialData.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows `Map` and map container when there are no occurrences', async () => {
    mockBiohubApi().search.getSpatialData.mockReturnValue([]);

    const { getByText, getByTestId } = renderContainer();

    await waitFor(() => {
      expect(getByText('Map')).toBeVisible();
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

    mockBiohubApi().search.getSpatialData.mockReturnValue(vaildFeatureCollection);

    const { getByText, getByTestId } = renderContainer();

    await waitFor(() => {
      expect(getByText('Map')).toBeVisible();
      expect(getByTestId('MapContainer')).toBeVisible();
    });
  });
});
