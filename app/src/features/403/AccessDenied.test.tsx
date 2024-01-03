import { SYSTEM_ROLE } from 'constants/roles';
import { AuthStateContext } from 'contexts/authStateContext';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import { getMockAuthState, SystemUserAuthState } from 'test-helpers/auth-helpers';
import { render } from 'test-helpers/test-utils';
import AccessDenied from './AccessDenied';

const history = createMemoryHistory();

describe('AccessDenied', () => {
  it('renders correctly when the user is authenticated', () => {
    const authState = getMockAuthState({
      base: SystemUserAuthState,
      overrides: { biohubUserWrapper: { roleNames: [SYSTEM_ROLE.DATA_ADMINISTRATOR] } }
    });

    const { getByText } = render(
      <AuthStateContext.Provider value={authState}>
        <Router history={history}>
          <AccessDenied />
        </Router>
      </AuthStateContext.Provider>
    );

    expect(getByText('You do not have permission to access this page.')).toBeVisible();
  });
});
