import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { PortalRouter } from './PortalRouter';

vi.mock('features/portal/PortalPage', () => ({
  default: () => <div data-testid="portal-page">Portal Page</div>
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

describe('PortalRouter', () => {
  it('renders portal list route', async () => {
    const { findByTestId } = render(
      <MemoryRouter initialEntries={['/portal']}>
        <Routes>
          <Route path="/portal/*" element={<PortalRouter />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await findByTestId('portal-page')).toBeVisible();
  });

  it('renders portal submission detail route', async () => {
    const { findByTestId } = render(
      <MemoryRouter initialEntries={['/portal/submission/7']}>
        <Routes>
          <Route path="/portal/*" element={<PortalRouter />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await findByTestId('portal-submission-detail-page')).toBeVisible();
  });

  it('renders portal submission feature route', async () => {
    const { findByTestId } = render(
      <MemoryRouter initialEntries={['/portal/submission/7/feature/11']}>
        <Routes>
          <Route path="/portal/*" element={<PortalRouter />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await findByTestId('portal-submission-feature-page')).toBeVisible();
  });
});
