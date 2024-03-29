import { SYSTEM_ROLE } from 'constants/roles';
import { AuthStateContext } from 'contexts/authStateContext';
import { createMemoryHistory } from 'history';
import { Route, Router } from 'react-router';
import {
  getMockAuthState,
  SystemAdminAuthState,
  SystemUserAuthState,
  UnauthenticatedUserAuthState
} from 'test-helpers/auth-helpers';
import { render } from 'test-helpers/test-utils';
import { AuthGuard, SystemRoleGuard, UnAuthGuard } from './Guards';

const history = createMemoryHistory({ initialEntries: ['test/123'] });

describe('Guards', () => {
  describe('SystemRoleGuard', () => {
    describe('with no fallback', () => {
      it('renders the child when user has a matching valid system role', () => {
        const authState = getMockAuthState({ base: SystemAdminAuthState });

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
        const authState = getMockAuthState({ base: SystemUserAuthState });

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
        const authState = getMockAuthState({ base: SystemAdminAuthState });

        const { queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <SystemRoleGuard
                  validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                  fallback={<div data-testid="fallback-child-component" />}>
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
        const authState = getMockAuthState({ base: SystemUserAuthState });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <SystemRoleGuard
                  validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                  fallback={<div data-testid="fallback-child-component" />}>
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
        const authState = getMockAuthState({ base: SystemAdminAuthState });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <SystemRoleGuard
                  validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                  fallback={() => <div data-testid="fallback-child-component" />}>
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
        const authState = getMockAuthState({ base: SystemUserAuthState });

        const { getByTestId, queryByTestId } = render(
          <Router history={history}>
            <Route path="test/:id">
              <AuthStateContext.Provider value={authState}>
                <SystemRoleGuard
                  validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                  fallback={() => <div data-testid="fallback-child-component" />}>
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
        const authState = getMockAuthState({ base: SystemAdminAuthState });

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
        const authState = getMockAuthState({ base: UnauthenticatedUserAuthState });

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
        const authState = getMockAuthState({ base: SystemAdminAuthState });

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
        const authState = getMockAuthState({ base: UnauthenticatedUserAuthState });

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
        const authState = getMockAuthState({ base: SystemAdminAuthState });

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
        const authState = getMockAuthState({ base: UnauthenticatedUserAuthState });

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
        const authState = getMockAuthState({ base: UnauthenticatedUserAuthState });
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
        const authState = getMockAuthState({ base: SystemAdminAuthState });

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
        const authState = getMockAuthState({ base: UnauthenticatedUserAuthState });

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
        const authState = getMockAuthState({ base: SystemAdminAuthState });

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
        const authState = getMockAuthState({ base: UnauthenticatedUserAuthState });

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
        const authState = getMockAuthState({ base: SystemAdminAuthState });

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
