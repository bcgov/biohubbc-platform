import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthStateContext } from 'contexts/authStateContext';
import { SYSTEM_ROLE } from 'constants/roles';
import { getMockAuthState, SystemAdminAuthState, SystemUserAuthState } from 'test-helpers/auth-helpers';
import { waitFor } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { AdminRouter } from './AdminRouter';

vi.mock('features/admin/policies/ManagePoliciesPage', () => ({
  ManagePoliciesPage: () => <div data-testid="manage-policies-page">Manage Policies Page</div>
}));

vi.mock('features/admin/policies/PolicyDetailPage', () => ({
  PolicyDetailPage: () => <div data-testid="policy-detail-page">Policy Detail Page</div>
}));

vi.mock('features/admin/users/ManageUsersPage', () => ({
  default: () => <div data-testid="manage-users-page">Manage Users Page</div>
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

vi.mock('features/admin/reviews/SubmissionUploadReviewValidationPage', () => ({
  SubmissionUploadReviewValidationPage: () => (
    <div data-testid="submission-upload-review-validation-page">Validation Review</div>
  )
}));

vi.mock('features/admin/reviews/SubmissionReviewFeaturePage', () => ({
  SubmissionReviewFeaturePage: () => <div data-testid="submission-review-feature-page">Review Feature</div>
}));

describe('AdminRouter ticket route guard', () => {
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

  it('renders the validation review route for system admin', async () => {
    const authState = getMockAuthState({ base: SystemAdminAuthState });

    const { getByTestId } = renderAdminRouter(
      authState,
      '/admin/submission/16/upload/11111111-1111-4111-8111-111111111111/review/22222222-2222-4222-8222-222222222222'
    );

    await waitFor(() => {
      expect(getByTestId('submission-upload-review-validation-page')).toBeVisible();
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
});
