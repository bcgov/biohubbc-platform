import { SYSTEM_ROLE } from 'constants/roles';
import { AuthStateContext } from 'contexts/authStateContext';
import { createMemoryHistory } from 'history';
import { Route, Router } from 'react-router';
import { getMockAuthState } from 'test-helpers/auth-helpers';
import { render } from 'test-helpers/test-utils';
import { AuthGuard, NoRoleGuard, SystemRoleGuard, UnAuthGuard } from './Guards';

const history = createMemoryHistory({ initialEntries: ['test/123'] });

describe('Guards', () => {
  describe('NoRoleGuard', () => {
    describe('with no fallback', () => {
      it('renders the child when user has no matching valid system role', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { hasSystemRole: () => false }
        });

        const { getByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <NoRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
                  <div data-testid="child-component" />
                </NoRoleGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(getByTestId('child-component')).toBeInTheDocument();
      });

      it('does not render the child when user has a matching valid system role', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { hasSystemRole: () => true }
        });

        const { queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <NoRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
                  <div data-testid="child-component" />
                </NoRoleGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).not.toBeInTheDocument();
      });
    });

    describe('with a fallback component', () => {
      it('renders the child when user has no matching valid system role', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { hasSystemRole: () => false }
        });

        const { queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <NoRoleGuard
                  validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                  fallback={<div data-testid="fallback-child-component" />}
                >
                  <div data-testid="child-component" />
                </NoRoleGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).toBeInTheDocument();
        expect(queryByTestId('fallback-child-component')).not.toBeInTheDocument();
      });

      it('renders the fallback component when user has a matching valid system role', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { hasSystemRole: () => true }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <NoRoleGuard
                  validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                  fallback={<div data-testid="fallback-child-component" />}
                >
                  <div data-testid="child-component" />
                </NoRoleGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).not.toBeInTheDocument();
        expect(getByTestId('fallback-child-component')).toBeInTheDocument();
      });
    });

    describe('with a fallback function', () => {
      it('renders the child when user has no matching valid system role', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { hasSystemRole: () => false }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <NoRoleGuard
                  validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                  fallback={() => <div data-testid="fallback-child-component">{'123'}</div>}
                >
                  <div data-testid="child-component" />
                </NoRoleGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(getByTestId('child-component')).toBeInTheDocument();
        expect(queryByTestId('fallback-child-component')).not.toBeInTheDocument();
      });

      it('renders the fallback component when user has a matching valid system role', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { hasSystemRole: () => true }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <NoRoleGuard
                  validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                  fallback={() => <div data-testid="fallback-child-component">{'123'}</div>}
                >
                  <div data-testid="child-component" />
                </NoRoleGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).not.toBeInTheDocument();
        expect(getByTestId('fallback-child-component')).toBeInTheDocument();
        expect(getByTestId('fallback-child-component').textContent).toEqual('123');
      });
    });
  });

  describe('SystemRoleGuard', () => {
    describe('with no fallback', () => {
      it('renders the child when user has a matching valid system role', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { hasSystemRole: () => true }
        });

        const { getByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <SystemRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
                  <div data-testid="child-component" />
                </SystemRoleGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(getByTestId('child-component')).toBeInTheDocument();
      });

      it('does not render the child when user has no matching valid system role', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { hasSystemRole: () => false }
        });

        const { queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <SystemRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
                  <div data-testid="child-component" />
                </SystemRoleGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).not.toBeInTheDocument();
      });
    });

    describe('with a fallback component', () => {
      it('renders the child when user has a matching valid system roles', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { hasSystemRole: () => true }
        });

        const { queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <SystemRoleGuard
                  validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                  fallback={<div data-testid="fallback-child-component" />}
                >
                  <div data-testid="child-component" />
                </SystemRoleGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).toBeInTheDocument();
        expect(queryByTestId('fallback-child-component')).not.toBeInTheDocument();
      });

      it('renders the fallback component when user has no matching valid system roles', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { hasSystemRole: () => false }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <SystemRoleGuard
                  validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                  fallback={<div data-testid="fallback-child-component" />}
                >
                  <div data-testid="child-component" />
                </SystemRoleGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).not.toBeInTheDocument();
        expect(getByTestId('fallback-child-component')).toBeInTheDocument();
      });
    });

    describe('with a fallback function', () => {
      it('renders the child when user has a matching valid system role', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { hasSystemRole: () => true }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <SystemRoleGuard
                  validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                  fallback={() => <div data-testid="fallback-child-component" />}
                >
                  <div data-testid="child-component" />
                </SystemRoleGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(getByTestId('child-component')).toBeInTheDocument();
        expect(queryByTestId('fallback-child-component')).not.toBeInTheDocument();
      });

      it('renders the fallback component when user has no matching valid system role', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { hasSystemRole: () => false }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <SystemRoleGuard
                  validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                  fallback={() => <div data-testid="fallback-child-component" />}
                >
                  <div data-testid="child-component" />
                </SystemRoleGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).not.toBeInTheDocument();
        expect(getByTestId('fallback-child-component')).toBeInTheDocument();
      });
    });
  });

  describe('AuthGuard', () => {
    describe('with no fallback', () => {
      it('renders the child when user is authenticated', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { keycloak: { authenticated: true }, hasLoadedAllUserInfo: true }
        });

        const { getByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <AuthGuard>
                  <div data-testid="child-component" />
                </AuthGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(getByTestId('child-component')).toBeInTheDocument();
      });

      it('does not render the child when user is not authenticated', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { keycloak: { authenticated: false }, hasLoadedAllUserInfo: false }
        });

        const { queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <AuthGuard>
                  <div data-testid="child-component" />
                </AuthGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).not.toBeInTheDocument();
      });
    });

    describe('with a fallback component', () => {
      it('renders the child when user is authenticated', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { keycloak: { authenticated: true }, hasLoadedAllUserInfo: true }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <AuthGuard fallback={<div data-testid="fallback-child-component" />}>
                  <div data-testid="child-component" />
                </AuthGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(getByTestId('child-component')).toBeInTheDocument();
        expect(queryByTestId('fallback-child-component')).not.toBeInTheDocument();
      });

      it('renders the fallback component when user is not authenticated', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { keycloak: { authenticated: false }, hasLoadedAllUserInfo: false }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <AuthGuard fallback={<div data-testid="fallback-child-component" />}>
                  <div data-testid="child-component" />
                </AuthGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).not.toBeInTheDocument();
        expect(getByTestId('fallback-child-component')).toBeInTheDocument();
      });
    });

    describe('with a fallback function', () => {
      it('renders the child when user is authenticated', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { keycloak: { authenticated: true }, hasLoadedAllUserInfo: true }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <AuthGuard fallback={() => <div data-testid="fallback-child-component" />}>
                  <div data-testid="child-component" />
                </AuthGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(getByTestId('child-component')).toBeInTheDocument();
        expect(queryByTestId('fallback-child-component')).not.toBeInTheDocument();
      });

      it('renders the fallback component when user is not authenticated', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { keycloak: { authenticated: false }, hasLoadedAllUserInfo: false }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <AuthGuard fallback={() => <div data-testid="fallback-child-component" />}>
                  <div data-testid="child-component" />
                </AuthGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).not.toBeInTheDocument();
        expect(getByTestId('fallback-child-component')).toBeInTheDocument();
      });
    });
  });

  describe('UnAuthGuard', () => {
    describe('with no fallback', () => {
      it('renders the child when user is not authenticated', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { keycloak: { authenticated: false }, hasLoadedAllUserInfo: false }
        });

        const { getByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <UnAuthGuard>
                  <div data-testid="child-component" />
                </UnAuthGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(getByTestId('child-component')).toBeInTheDocument();
      });

      it('does not render the child when user is authenticated', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { keycloak: { authenticated: true }, hasLoadedAllUserInfo: true }
        });

        const { queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <UnAuthGuard>
                  <div data-testid="child-component" />
                </UnAuthGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).not.toBeInTheDocument();
      });
    });

    describe('with a fallback component', () => {
      it('renders the child when user is not authenticated', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { keycloak: { authenticated: false }, hasLoadedAllUserInfo: false }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <UnAuthGuard fallback={<div data-testid="fallback-child-component" />}>
                  <div data-testid="child-component" />
                </UnAuthGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(getByTestId('child-component')).toBeInTheDocument();
        expect(queryByTestId('fallback-child-component')).not.toBeInTheDocument();
      });

      it('renders the fallback component when user is authenticated', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { keycloak: { authenticated: true }, hasLoadedAllUserInfo: true }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <UnAuthGuard fallback={<div data-testid="fallback-child-component" />}>
                  <div data-testid="child-component" />
                </UnAuthGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).not.toBeInTheDocument();
        expect(getByTestId('fallback-child-component')).toBeInTheDocument();
      });
    });

    describe('with a fallback function', () => {
      it('renders the child when user is not authenticated', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { keycloak: { authenticated: false }, hasLoadedAllUserInfo: false }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <UnAuthGuard fallback={() => <div data-testid="fallback-child-component" />}>
                  <div data-testid="child-component" />
                </UnAuthGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(getByTestId('child-component')).toBeInTheDocument();
        expect(queryByTestId('fallback-child-component')).not.toBeInTheDocument();
      });

      it('renders the fallback component when user is authenticated', () => {
        const authState = getMockAuthState({
          keycloakWrapper: { keycloak: { authenticated: true }, hasLoadedAllUserInfo: true }
        });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <UnAuthGuard fallback={() => <div data-testid="fallback-child-component" />}>
                  <div data-testid="child-component" />
                </UnAuthGuard>
              </AuthStateContext.Provider>
            </Route>
          </Router>
        );

        expect(queryByTestId('child-component')).not.toBeInTheDocument();
        expect(getByTestId('fallback-child-component')).toBeInTheDocument();
      });
    });
  });
});
