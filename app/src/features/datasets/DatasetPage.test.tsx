import { ThemeProvider } from '@mui/styles';
import { cleanup, render, waitFor } from '@testing-library/react';
import { FeatureCollection } from 'geojson';
import { createMemoryHistory } from 'history';
import { useApi } from 'hooks/useApi';
import { Router } from 'react-router';
import appTheme from 'themes/appTheme';
import DatasetPage from './DatasetPage';

const history = createMemoryHistory();

const renderContainer = () => {
  return render(
    <ThemeProvider theme={appTheme}>
      <Router history={history}>
        <DatasetPage />
      </Router>
    </ThemeProvider>
  );
};

jest.mock('../../hooks/useApi');

const mockUseApi = {
  dataset: {
    getDatasetEML: jest.fn()
  },
  search: {
    getSpatialData: jest.fn(),
    getSpatialDataFile: jest.fn()
  }
};

const mockBiohubApi = useApi as jest.Mock;

describe('DatasetPage', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the empty page content correctly', async () => {
    mockUseApi.search.getSpatialDataFile.mockResolvedValue([]);

    mockUseApi.search.getSpatialData.mockResolvedValue([]);

    mockUseApi.dataset.getDatasetEML.mockResolvedValue([]);

    const { getByTestId } = renderContainer();

    await waitFor(() => {
      expect(getByTestId('MapContainer')).toBeVisible();
    });
  });

  it('shows eml metadata as well as map points', async () => {
    const validFeatureCollection: FeatureCollection = {
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

    const hexDoc = '';

    mockUseApi.search.getSpatialDataFile.mockResolvedValue(hexDoc);

    mockUseApi.search.getSpatialData.mockReturnValue(validFeatureCollection);

    mockUseApi.dataset.getDatasetEML.mockResolvedValue({
      'eml:eml': {
        dataset: {
          contact: {
            organizationName: 'organization name'
          }
        }
      }
    });

    const { getByTestId, getByText } = renderContainer();

    await waitFor(() => {
      expect(getByTestId('MapContainer')).toBeVisible();
      expect(getByText('organization name')).toBeVisible();
      expect(getByTestId('export-occurrence')).toBeVisible();
    });
  });
});