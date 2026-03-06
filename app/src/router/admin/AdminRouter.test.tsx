import { MemoryRouter } from 'react-router-dom';
import { AuthStateContext } from 'contexts/authStateContext';
import { SYSTEM_ROLE } from 'constants/roles';
import { getMockAuthState, SystemAdminAuthState, SystemUserAuthState } from 'test-helpers/auth-helpers';
import { waitFor } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { AdminRouter } from './AdminRouter';

vi.mock('./ticket/TicketsRouter', () => ({
  TicketsRouter: () => <div data-testid="tickets-router">Tickets Router</div>
}));

describe('AdminRouter ticket route guard', () => {
  it('renders tickets route for system admin', async () => {
    const authState = getMockAuthState({ base: SystemAdminAuthState });

    const { getByTestId } = render(
      <AuthStateContext.Provider value={authState}>
        <MemoryRouter initialEntries={['/tickets']}>
          <AdminRouter />
        </MemoryRouter>
      </AuthStateContext.Provider>
    );

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

    const { queryByTestId } = render(
      <AuthStateContext.Provider value={authState}>
        <MemoryRouter initialEntries={['/tickets']}>
          <AdminRouter />
        </MemoryRouter>
      </AuthStateContext.Provider>
    );

    await waitFor(() => {
      expect(queryByTestId('tickets-router')).toBeNull();
    });
  });
});
