import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { IGetMapOccurrenceData } from 'components/map/OccurrenceFeaturePopup';
import { Feature } from 'geojson';
import { useApi } from 'hooks/useApi';
import React from 'react';
import MapPage from './MapPage';

jest.mock('../../hooks/useApi');
const mockUseApi = {
  search: {
    getMapOccurrenceData: jest.fn()
  }
};

const renderContainer = () => {
  return render(<MapPage />);
};

const mockBiohubApi = (useApi as unknown as jest.Mock<typeof mockUseApi>).mockReturnValue(mockUseApi);

describe('MapPage', () => {
  beforeEach(() => {
    // clear mocks before each test
    mockBiohubApi().search.getMapOccurrenceData.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows `Map` and map container when there are no occurrences', async () => {
    mockBiohubApi().search.getMapOccurrenceData.mockReturnValue([]);

    const { getByText, getByTestId } = renderContainer();

    await waitFor(() => {
      expect(getByText('Map')).toBeVisible();
      expect(getByTestId('MapContainer')).toBeVisible();
    });
  });

  it('shows `Map` and map container with data points when there is occurrences', async () => {
    const vaildDataObject = {
      id: '1',
      taxonid: 'string',
      geometry: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [-129.083298513, 55.40257311]
        }
      } as Feature,
      observations: [
        {
          eventdate: 'string',
          data: [
            {
              lifestage: 'string',
              vernacularname: 'string',
              sex: 'string',
              individualcount: '1',
              organismquantity: '1',
              organismquantitytype: 'string'
            }
          ]
        }
      ]
    } as unknown as IGetMapOccurrenceData;

    mockBiohubApi().search.getMapOccurrenceData.mockReturnValue([vaildDataObject]);

    const { getByText, getByTestId } = renderContainer();

    screen.debug();
    await waitFor(() => {
      expect(getByText('Map')).toBeVisible();
      expect(getByTestId('MapContainer')).toBeVisible();
    });
  });
});
