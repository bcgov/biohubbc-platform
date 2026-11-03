import { waitFor } from '@testing-library/react';
import { SYSTEM_ROLE } from 'constants/roles';
import { AuthStateContext } from 'contexts/authStateContext';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  getMockAuthState,
  SystemAdminAuthState,
  SystemUserAuthState,
  UnauthenticatedUserAuthState
} from 'test-helpers/auth-helpers';
import { render } from 'test-helpers/test-utils';
import { AdminRouter } from './AdminRouter';

vi.mock('features/admin2/security/AdminSecurityPage', () => ({
  AdminSecurityPage: () => <div data-testid="admin-security-page">Security Page</div>
}));

vi.mock('features/admin/policies/PolicyDetailPage', () => ({
  PolicyDetailPage: () => <div data-testid="policy-detail-page">Policy Detail Page</div>
}));

vi.mock('features/admin/users/contributors/ContributorDetailPage', () => ({
  ContributorDetailPage: () => <div data-testid="contributor-detail-page">Contributor Details</div>
}));
vi.mock('features/admin/users/contributors/codesets/ContributorCodesetDetailPage', () => ({
  ContributorCodesetDetailPage: () => <div data-testid="contributor-codeset-detail-page">Codeset Details</div>
}));

vi.mock('features/admin2/users/AdminUsersPage', () => ({
  AdminUsersPage: () => <div data-testid="manage-users-page">Manage Users Page</div>
}));

vi.mock('./submission/SubmissionRouter', () => ({
  SubmissionsRouter: () => <div data-testid="submissions-router">Submissions Router</div>
}));

vi.mock('layouts/BaseLayout', () => ({
  default: ({ children }: { children: unknown }) => <>{children}</>
}));

vi.mock('utils/RouteWithMeta', () => ({
  PageTitle: () => null
}));

vi.mock('./ticket/TicketsRouter', () => ({
  TicketsRouter: () => <div data-testid="tickets-router">Tickets Router</div>
}));

vi.mock('features/admin/reviews/SubmissionUploadReviewPage', () => ({
  SubmissionUploadReviewPage: () => <div data-testid="submission-upload-review-page">Upload Review</div>
}));

vi.mock('features/admin/reviews/SubmissionReviewFeaturePage', () => ({
  SubmissionReviewFeaturePage: () => <div data-testid="submission-review-feature-page">Review Feature</div>
}));

vi.mock('features/admin2/security/category/AdminSecurityCategoryPage', () => ({
  AdminSecurityCategoryPage: () => <div data-testid="admin-security-category-page" />
}));

vi.mock('features/admin2/data-requests/detail/feature-type/AdminDataRequestFeatureTypePage', () => ({
  AdminDataRequestFeatureTypePage: () => <div data-testid="data-request-feature-type-page" />
}));

vi.mock('features/admin2/data-requests/detail/AdminDataRequestPage', () => ({
  AdminDataRequestPage: () => <div data-testid="data-request-page" />
}));

vi.mock('features/admin2/data-requests/AdminDataRequestsPage', () => ({
  AdminDataRequestsPage: () => <div data-testid="data-requests-page" />
}));

vi.mock('features/admin2/configuration/AdminConfigurationPage', () => ({
  AdminConfigurationPage: () => <div data-testid="configuration-page" />
}));

vi.mock('features/admin/configuration/blueprint/BlueprintPage', () => ({
  BlueprintPage: () => <div data-testid="blueprint-page" />
}));

describe('AdminRouter access guards', () => {
  const renderAdminRouter = (authState: ReturnType<typeof getMockAuthState>, initialEntry = '/admin/tickets') =>
    render(
      <AuthStateContext.Provider value={authState}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/admin/*" element={<AdminRouter />} />
            <Route path="/forbidden" element={<div data-testid="forbidden-page">Forbidden</div>} />
            <Route path="/page-not-found" element={<div data-testid="not-found-page">Not Found</div>} />
          </Routes>
        </MemoryRouter>
      </AuthStateContext.Provider>
    );

  for (const [path, testId] of [
    ['/admin/configuration', 'configuration-page'],
    ['/admin/configuration/blueprints/1', 'blueprint-page'],
    ['/admin/tickets/boards/board-1', 'tickets-router'],
    ['/admin/tickets/tags/tag-1', 'tickets-router']
  ]) {
    it(`allows system administrators at ${path}`, async () => {
      const page = renderAdminRouter(getMockAuthState({ base: SystemAdminAuthState }), path);
      expect(await page.findByTestId(testId)).toBeVisible();
    });
    it(`denies data administrators at ${path}`, async () => {
      const page = renderAdminRouter(
        getMockAuthState({
          base: SystemUserAuthState,
          overrides: {
            biohubUserWrapper: { roleNames: [SYSTEM_ROLE.DATA_ADMINISTRATOR] }
          }
        }),
        path
      );
      expect(await page.findByTestId('forbidden-page')).toBeVisible();
      expect(page.queryByTestId(testId)).toBeNull();
    });
  }

  it.each(['/admin/boards', '/admin/boards/board-1', '/admin/tags', '/admin/tag-rules', '/admin/tag-rules/new'])(
    'no longer routes %s, which moved to the tickets page',
    async (path) => {
      const page = renderAdminRouter(getMockAuthState({ base: SystemAdminAuthState }), path);
      expect(await page.findByTestId('not-found-page')).toBeVisible();
    }
  );

  it.each([
    ['redirects the policies route to the data requests page', '/admin/policies', 'data-requests-page'],
    ['renders the data request route', '/admin/data-requests/request-1', 'data-request-page'],
    [
      'renders the data request feature type route',
      '/admin/data-requests/request-1/feature-types/telemetry',
      'data-request-feature-type-page'
    ],
    ['renders the security category route', '/admin/security/categories/3', 'admin-security-category-page']
  ])('%s for data admin', async (_description, path, testId) => {
    const authState = getMockAuthState({
      base: SystemUserAuthState,
      overrides: {
        biohubUserWrapper: {
          roleNames: [SYSTEM_ROLE.DATA_ADMINISTRATOR]
        }
      }
    });

    const { findByTestId } = renderAdminRouter(authState, path);

    expect(await findByTestId(testId)).toBeVisible();
  });

  it('renders tickets route for system admin', async () => {
    const authState = getMockAuthState({ base: SystemAdminAuthState });

    const { getByTestId } = renderAdminRouter(authState);

    await waitFor(() => {
      expect(getByTestId('tickets-router')).toBeVisible();
    });
  });

  it('does not render tickets route for data admin', async () => {
    const authState = getMockAuthState({
      base: SystemUserAuthState,
      overrides: {
        biohubUserWrapper: {
          roleNames: [SYSTEM_ROLE.DATA_ADMINISTRATOR]
        }
      }
    });

    const { queryByTestId, getByTestId } = renderAdminRouter(authState);

    await waitFor(() => {
      expect(queryByTestId('tickets-router')).toBeNull();
      expect(getByTestId('forbidden-page')).toBeVisible();
    });
  });

  it('renders policy detail route for data admin', async () => {
    const authState = getMockAuthState({
      base: SystemUserAuthState,
      overrides: {
        biohubUserWrapper: {
          roleNames: [SYSTEM_ROLE.DATA_ADMINISTRATOR]
        }
      }
    });

    const { getByTestId } = renderAdminRouter(authState, '/admin/policy/policy-1');

    await waitFor(() => {
      expect(getByTestId('policy-detail-page')).toBeVisible();
    });
  });

  it('renders the upload review route for system admin', async () => {
    const authState = getMockAuthState({ base: SystemAdminAuthState });

    const { getByTestId } = renderAdminRouter(
      authState,
      '/admin/submission/16/upload/11111111-1111-4111-8111-111111111111/review/22222222-2222-4222-8222-222222222222'
    );

    await waitFor(() => {
      expect(getByTestId('submission-upload-review-page')).toBeVisible();
    });
  });

  it('does not route to a scoped security review URL', async () => {
    const authState = getMockAuthState({ base: SystemAdminAuthState });

    const { getByTestId } = renderAdminRouter(
      authState,
      '/admin/submission/16/upload/11111111-1111-4111-8111-111111111111/review/security/22222222-2222-4222-8222-222222222222'
    );

    await waitFor(() => {
      expect(getByTestId('not-found-page')).toBeVisible();
    });
  });
  for (const [path, testId] of [
    ['/admin/users', 'manage-users-page'],
    ['/admin/users?tab=contributors', 'manage-users-page'],
    ['/admin/users/contributor/123', 'contributor-detail-page'],
    ['/admin/users/contributor/123/codeset/45', 'contributor-codeset-detail-page']
  ]) {
    it(`allows system administrators to access ${path}`, async () => {
      const page = renderAdminRouter(getMockAuthState({ base: SystemAdminAuthState }), path);
      expect(await page.findByTestId(testId)).toBeVisible();
    });

    for (const roleNames of [[], [SYSTEM_ROLE.DATA_ADMINISTRATOR]]) {
      it(`denies user management at ${path} with roles ${JSON.stringify(roleNames)}`, async () => {
        const authState = getMockAuthState({
          base: SystemUserAuthState,
          overrides: { biohubUserWrapper: { roleNames } }
        });
        const page = renderAdminRouter(authState, path);
        expect(await page.findByTestId('forbidden-page')).toBeVisible();
        expect(page.queryByTestId(testId)).not.toBeInTheDocument();
      });
    }

    it(`requires authentication at ${path}`, async () => {
      const signinRedirect = vi.fn();
      const authState = getMockAuthState({
        base: UnauthenticatedUserAuthState,
        overrides: { auth: { signinRedirect } }
      });
      const page = renderAdminRouter(authState, path);
      await waitFor(() => expect(signinRedirect).toHaveBeenCalled());
      expect(page.queryByTestId(testId)).not.toBeInTheDocument();
    });
  }
});
