import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { waitFor } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { PortalRouter } from './PortalRouter';

vi.mock('features/portal/PortalPage', () => ({
  default: ({ initialTab }: { initialTab?: string }) => (
    <div data-testid="portal-page">{initialTab ? `Portal Page (${initialTab})` : 'Portal Page'}</div>
  )
}));

vi.mock('contexts/ticketContext', () => ({
  UserTicketContextProvider: ({ children }: { children: unknown }) => <>{children}</>
}));

vi.mock('features/portal/PortalTicketDetailPage', () => ({
  PortalTicketDetailPage: () => <div data-testid="portal-ticket-detail-page">Portal Ticket Detail</div>
}));

vi.mock('features/portal/page/submission/PortalSubmissionDetailPage', () => ({
  PortalSubmissionDetailPage: () => <div data-testid="portal-submission-detail-page">Portal Submission Detail</div>
}));

vi.mock('features/portal/page/submission/PortalSubmissionFeaturePage', () => ({
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

  it('renders portal list route', async () => {
    const { getByTestId } = renderPortalRouter('/portal');

    await waitFor(() => {
      expect(getByTestId('portal-page')).toBeVisible();
      expect(getByTestId('portal-page')).toHaveTextContent('Portal Page');
    });
  });

  it('renders tickets tab route', async () => {
    const { getByTestId } = renderPortalRouter('/portal/ticket');

    await waitFor(() => {
      expect(getByTestId('portal-page')).toBeVisible();
      expect(getByTestId('portal-page')).toHaveTextContent('Portal Page (tickets)');
    });
  });

  it('renders submissions tab route', async () => {
    const { getByTestId } = renderPortalRouter('/portal/submission');

    await waitFor(() => {
      expect(getByTestId('portal-page')).toBeVisible();
      expect(getByTestId('portal-page')).toHaveTextContent('Portal Page (submissions)');
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
