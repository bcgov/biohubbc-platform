import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { waitFor } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { PortalRouter } from './PortalRouter';

vi.mock('features/portal/PortalPage', () => ({
  PortalPage: () => <div data-testid="portal-page">Portal Page</div>
}));

vi.mock('features/portal/submissions/PortalSubmissionsPage', () => ({
  PortalSubmissionsPage: () => <div data-testid="portal-submissions-page">Portal Submissions</div>
}));

vi.mock('features/portal/downloads/PortalDownloadsPage', () => ({
  PortalDownloadsPage: () => <div data-testid="portal-downloads-page">Portal Downloads</div>
}));

vi.mock('features/portal/data-requests/PortalDataRequestsPage', () => ({
  PortalDataRequestsPage: () => <div data-testid="portal-data-requests-page">Portal Data Requests</div>
}));

vi.mock('features/portal/tickets/PortalTicketsPage', () => ({
  PortalTicketsPage: () => <div data-testid="portal-tickets-page">Portal Tickets</div>
}));

vi.mock('features/portal/api-keys/PortalApiKeysPage', () => ({
  PortalApiKeysPage: () => <div data-testid="portal-api-keys-page">Portal API Keys</div>
}));

vi.mock('contexts/ticketContext', () => ({
  UserTicketContextProvider: ({ children }: { children: unknown }) => <>{children}</>
}));

vi.mock('features/portal/tickets/detail/PortalTicketDetailPage', () => ({
  PortalTicketDetailPage: () => <div data-testid="portal-ticket-detail-page">Portal Ticket Detail</div>
}));

vi.mock('features/portal/submissions/detail/PortalSubmissionDetailPage', () => ({
  PortalSubmissionDetailPage: () => <div data-testid="portal-submission-detail-page">Portal Submission Detail</div>
}));

vi.mock('features/portal/submissions/detail/feature/PortalSubmissionFeaturePage', () => ({
  PortalSubmissionFeaturePage: () => <div data-testid="portal-submission-feature-page">Portal Submission Feature</div>
}));

vi.mock('utils/RouteWithMeta', () => ({
  PageTitle: () => null
}));

describe('PortalRouter routes', () => {
  const renderPortalRouter = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/portal/*" element={<PortalRouter />} />
          <Route path="/page-not-found" element={<div data-testid="not-found-page">Not Found</div>} />
        </Routes>
      </MemoryRouter>
    );

  it.each([
    ['/portal', 'portal-page'],
    ['/portal/submission', 'portal-submissions-page'],
    ['/portal/download', 'portal-downloads-page'],
    ['/portal/data-request', 'portal-data-requests-page'],
    ['/portal/ticket', 'portal-tickets-page'],
    ['/portal/api-key', 'portal-api-keys-page']
  ])('renders %s', async (path, testId) => {
    const { getByTestId } = renderPortalRouter(path);

    await waitFor(() => {
      expect(getByTestId(testId)).toBeVisible();
    });
  });

  it('renders portal ticket detail route', async () => {
    const { getByTestId } = renderPortalRouter('/portal/ticket/7');

    await waitFor(() => {
      expect(getByTestId('portal-ticket-detail-page')).toBeVisible();
    });
  });

  it('renders portal submission detail route', async () => {
    const { getByTestId } = renderPortalRouter('/portal/submission/7');

    await waitFor(() => {
      expect(getByTestId('portal-submission-detail-page')).toBeVisible();
    });
  });

  it('renders portal submission feature route', async () => {
    const { getByTestId } = renderPortalRouter('/portal/submission/7/feature/11');

    await waitFor(() => {
      expect(getByTestId('portal-submission-feature-page')).toBeVisible();
    });
  });

  it('redirects unknown route to not found page', async () => {
    const { queryByTestId, getByTestId } = renderPortalRouter('/portal/not-a-real-route');

    await waitFor(() => {
      expect(queryByTestId('portal-page')).toBeNull();
      expect(getByTestId('not-found-page')).toBeVisible();
    });
  });
});
