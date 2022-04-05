import { SystemRoleGuard } from 'components/security/Guards';
import { AuthenticatedRouteGuard } from 'components/security/RouteGuards';
import { SYSTEM_ROLE } from 'constants/roles';
import AccessDenied from 'features/403/AccessDenied';
import NotFoundPage from 'features/404/NotFoundPage';
import AccessRequestPage from 'features/access/AccessRequestPage';
import RequestSubmitted from 'features/access/RequestSubmitted';
import AdminUsersRouter from 'features/admin/AdminUsersRouter';
import HomeRouter from 'features/home/HomeRouter';
import LogOutPage from 'features/logout/LogOutPage';
import SearchRouter from 'features/search/SearchRouter';
import BaseLayout from 'layouts/BaseLayout';
import React from 'react';
import { Redirect, Switch, useLocation } from 'react-router-dom';
import AppRoute from 'utils/AppRoute';

const AppRouter: React.FC = () => {
  const location = useLocation();

  const getTitle = (page: string) => {
    return `BioHub - ${page}`;
  };

  return (
    <Switch>
      <Redirect from="/:url*(/+)" to={{ ...location, pathname: location.pathname.slice(0, -1) }} />

      <AppRoute path="/" title={getTitle('Search')} layout={BaseLayout}>
        <HomeRouter />
      </AppRoute>

      <AppRoute path="/search" title={getTitle('Search')} layout={BaseLayout}>
        <SearchRouter />
      </AppRoute>

      <AppRoute path="/page-not-found" title={getTitle('Page Not Found')} layout={BaseLayout}>
        <NotFoundPage />
      </AppRoute>

      <AppRoute path="/forbidden" title={getTitle('Forbidden')} layout={BaseLayout}>
        <AccessDenied />
      </AppRoute>

      <AppRoute path="/access-request" title={getTitle('Access Request')} layout={BaseLayout}>
        <AuthenticatedRouteGuard>
          <AccessRequestPage />
        </AuthenticatedRouteGuard>
      </AppRoute>

      <AppRoute path="/request-submitted" title={getTitle('Request submitted')} layout={BaseLayout}>
        <AuthenticatedRouteGuard>
          <RequestSubmitted />
        </AuthenticatedRouteGuard>
      </AppRoute>

      <Redirect exact from="/admin" to="/admin/users" />

      <AppRoute path="/admin/users" title={getTitle('Users')} layout={BaseLayout}>
        <AuthenticatedRouteGuard>
          <SystemRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
            <AdminUsersRouter />
          </SystemRoleGuard>
        </AuthenticatedRouteGuard>
      </AppRoute>

      <AppRoute path="/logout" title={getTitle('Logout')} layout={BaseLayout}>
        <AuthenticatedRouteGuard>
          <LogOutPage />
        </AuthenticatedRouteGuard>
      </AppRoute>

      <AppRoute title="*" path="*">
        <Redirect to="/page-not-found" />
      </AppRoute>
    </Switch>
  );
};

export default AppRouter;
