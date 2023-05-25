import { ThemeProvider } from '@mui/styles';
import { cleanup, render, waitFor } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { useApi } from 'hooks/useApi';
import useKeycloakWrapper from 'hooks/useKeycloakWrapper';
import { Router } from 'react-router';
import appTheme from 'themes/appTheme';
import DashboardPage from './DashboardPage';

const history = createMemoryHistory();

jest.mock('../../../hooks/useApi');
jest.mock('../../../hooks/useKeycloakWrapper');

const mockUseKeycloakWrapper = {
  hasSystemRole: (_roles: string[]) => true
};

const mockUseApi = {
  dataset: {
    listAllDatasetsForReview: jest.fn()
  }
};

const renderContainer = () => {
  return render(
    <ThemeProvider theme={appTheme}>
      <Router history={history}>
        <DashboardPage />
      </Router>
    </ThemeProvider>
  );
};

const mockBiohubApi = useApi as jest.Mock;
const mockKeycloakWrapper = useKeycloakWrapper as jest.Mock;

describe('DashboardPage', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
    mockKeycloakWrapper.mockImplementation(() => mockUseKeycloakWrapper);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a page with no security reviews', async () => {
    mockUseApi.dataset.listAllDatasetsForReview.mockResolvedValue([]);

    const { getByTestId } = renderContainer();

    await waitFor(() => {
      expect(getByTestId('no-security-reviews')).toBeVisible();
    });
  });

  it('renders a page with a table of security reviews', async () => {
    mockUseApi.dataset.listAllDatasetsForReview.mockResolvedValue([
      {
        dataset_id: 'UUID-1',
        artifacts_to_review: 6,
        dataset_name: 'A Real Project',
        last_updated: '2023-05-25',
        keywords: ['PROJECT']
      }
    ]);

    const { findByText, container } = renderContainer();

    await waitFor(
      async () => {
        expect(await findByText('INVENTORY PROJECT')).toBeInTheDocument();
      },
      { container }
    );
  });
});
