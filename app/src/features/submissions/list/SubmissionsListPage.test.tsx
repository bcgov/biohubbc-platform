import { ThemeProvider } from '@mui/styles';
import { createTheme } from '@mui/system';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { useApi } from 'hooks/useApi';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useDatasetApi.interface';
import React from 'react';
import { Router } from 'react-router';
import SubmissionsListPage from './SubmissionsListPage';

const history = createMemoryHistory();

const renderPage = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <Router history={history}>
        <SubmissionsListPage />
      </Router>
    </ThemeProvider>
  );

jest.mock('../../../hooks/useApi');

const mockUseApi = {
  submissions: {
    getPublishedSubmissions: jest.fn()
  }
};

const mockBiohubApi = useApi as jest.Mock;

describe('SubmissionsListPage', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Mounting', () => {
    it('should render page', async () => {
      mockUseApi.submissions.getPublishedSubmissions.mockResolvedValue([]);
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.getByText(/biohub bc/i)).toBeVisible();
        expect(actions.getByPlaceholderText(/keyword/i)).toBeVisible();
      });
    });

    it('should render skeleton loaders', async () => {
      mockUseApi.submissions.getPublishedSubmissions.mockResolvedValue([]);
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.getByTestId('records-found-skeleton')).toBeVisible();
        expect(actions.getByTestId('submission-card-skeleton')).toBeVisible();
      });

      await waitFor(() => {
        expect(actions.getByText(/0 records found/i)).toBeVisible();
      });
    });
  });

  describe('Submission Cards', () => {
    it('should render submission card with download button when unsecured', async () => {
      mockUseApi.submissions.getPublishedSubmissions.mockResolvedValue([
        { submission_id: 1, security: SECURITY_APPLIED_STATUS.UNSECURED }
      ]);
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.getByRole('button', { name: /download/i })).toBeVisible();
        expect(actions.queryByRole('button', { name: /request access/i })).toBeNull();
      });
    });

    it('should render submission card with request access button when secured', async () => {
      mockUseApi.submissions.getPublishedSubmissions.mockResolvedValue([
        { submission_id: 1, security: SECURITY_APPLIED_STATUS.SECURED }
      ]);
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.getByRole('button', { name: /request access/i })).toBeVisible();
        expect(actions.queryByRole('button', { name: /download/i })).toBeNull();
      });
    });

    it('should render submission card with request access and download button when partially secured', async () => {
      mockUseApi.submissions.getPublishedSubmissions.mockResolvedValue([
        { submission_id: 1, security: SECURITY_APPLIED_STATUS.PARTIALLY_SECURED }
      ]);
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.getByRole('button', { name: /request access/i })).toBeVisible();
        expect(actions.getByRole('button', { name: /download/i })).toBeVisible();
      });
    });
  });

  describe('Secure Access Request Dialog', () => {
    it('should mount with dialog closed', async () => {
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.queryByText(/secure data access request/i)).toBeNull();
      });
    });

    it('should open dialog on request access button click', async () => {
      mockUseApi.submissions.getPublishedSubmissions.mockResolvedValue([
        { submission_id: 1, security: SECURITY_APPLIED_STATUS.SECURED }
      ]);
      const actions = renderPage();

      await waitFor(() => {
        const requestAccessBtn = actions.getByRole('button', { name: /request access/i });

        expect(requestAccessBtn).toBeVisible();

        fireEvent.click(requestAccessBtn);

        expect(actions.getByText(/secure data access request/i)).toBeVisible();
      });
    });
  });
});
