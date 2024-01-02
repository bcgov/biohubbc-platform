import { ThemeProvider } from '@mui/styles';
import { createTheme } from '@mui/system';
import { cleanup, render, waitFor } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { useApi } from 'hooks/useApi';
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

  describe('Mounting / General tests', () => {
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

    // it('should render submission card', async () => {
    //   mockUseApi.submissions.getPublishedSubmissions.mockResolvedValue([]);
    //   const actions = renderPage();
    //
    //   await waitFor(() => {
    //
    //   });
    //
    // });
  });

  // describe('Secure Access Request Dialog', () => {
  //   it('should display secure data access request dialog when selected', async () => {
  //     mockUseApi.submissions.getPublishedSubmissions.mockResolvedValue([{ security: 'UNSECURED' }]);
  //     const actions = renderPage();
  //     await waitFor(() => {
  //       expect(actions.getByText(/biohub bc/i)).toBeVisible();
  //     });
  //   });
  // });
});
