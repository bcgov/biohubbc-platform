import { ThemeProvider } from '@mui/styles';
import { cleanup, render, waitFor } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { useApi } from 'hooks/useApi';
import { Router } from 'react-router';
import appTheme from 'themes/appTheme';
import DashboardPage from './DashboardPage';

const history = createMemoryHistory();

jest.mock('../../../hooks/useApi');

const mockUseApi = {
  dataset: {
    getUnreviewedSubmissionsForAdmins: jest.fn()
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

describe('DashboardPage', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a page with no security reviews', async () => {
    mockUseApi.dataset.getUnreviewedSubmissionsForAdmins.mockResolvedValue([]);

    const { getByTestId } = renderContainer();

    await waitFor(() => {
      expect(getByTestId('no-security-reviews')).toBeVisible();
    });
  });

  it.skip('renders a page with a table of security reviews', async () => {
    mockUseApi.dataset.getUnreviewedSubmissionsForAdmins.mockResolvedValue([
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
