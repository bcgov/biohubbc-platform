import { cleanup, render, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router';
import { Mock, vi } from 'vitest';
import DashboardPage from './DashboardPage';

vi.mock('../../../hooks/useApi');

const mockUseApi = {
  submissions: {
    getUnreviewedSubmissionsForAdmins: vi.fn()
  }
};

const renderContainer = () => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <DashboardPage />
    </MemoryRouter>
  );
};

const mockBiohubApi = useApi as Mock;

describe('DashboardPage', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a page with no security reviews', async () => {
    mockUseApi.submissions.getUnreviewedSubmissionsForAdmins.mockResolvedValue([]);

    const { getByTestId } = renderContainer();

    await waitFor(() => {
      expect(getByTestId('no-security-reviews')).toBeVisible();
    });
  });

  it.skip('renders a page with a table of security reviews', async () => {
    mockUseApi.submissions.getUnreviewedSubmissionsForAdmins.mockResolvedValue([
      {
        survey_id: 'UUID-1',
        artifacts_to_review: 6,
        survey_name: 'A Real Project',
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
