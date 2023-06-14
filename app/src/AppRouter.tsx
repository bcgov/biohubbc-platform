import { SystemRoleGuard } from 'components/security/Guards';
import { AuthenticatedRouteGuard, UnAuthenticatedRouteGuard } from 'components/security/RouteGuards';
import { SYSTEM_ROLE } from 'constants/roles';
import AccessDenied from 'features/403/AccessDenied';
import NotFoundPage from 'features/404/NotFoundPage';
import AdminUsersRouter from 'features/admin/AdminUsersRouter';
import AdminDashboardRouter from 'features/admin/dashboard/AdminDashboardRouter';
import DatasetsRouter from 'features/datasets/DatasetsRouter';
import HomeRouter from 'features/home/HomeRouter';
import LogOutPage from 'features/logout/LogOutPage';
import MapRouter from 'features/map/MapRouter';
import SearchRouter from 'features/search/SearchRouter';
import BaseLayout from 'layouts/BaseLayout';
import ContentLayout from 'layouts/ContentLayout';
import LoginPage from 'pages/authentication/LoginPage';
import { Redirect, Route, Switch, useLocation } from 'react-router-dom';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';

const AppRouter: React.FC<React.PropsWithChildren> = () => {
  const location = useLocation();

  return (
    <Switch>
      <Redirect from="/:url*(/+)" to={{ ...location, pathname: location.pathname.slice(0, -1) }} />

      <Route exact path="/">
        <BaseLayout>
          <HomeRouter />
        </BaseLayout>
      </Route>

      <Route path="/search">
        <BaseLayout>
          <SearchRouter />
        </BaseLayout>
      </Route>

      <Route path="/datasets">
        <BaseLayout>
          <DatasetsRouter />
        </BaseLayout>
      </Route>

      <Route path="/map">
        <ContentLayout>
          <MapRouter />
        </ContentLayout>
      </Route>

      <RouteWithTitle path="/page-not-found" title={getTitle('Page Not Found')}>
        <BaseLayout>
          <NotFoundPage />
        </BaseLayout>
      </RouteWithTitle>

      <RouteWithTitle path="/forbidden" title={getTitle('Forbidden')}>
        <BaseLayout>
          <AccessDenied />
        </BaseLayout>
      </RouteWithTitle>

      <Redirect exact from="/admin" to="/admin/dashboard" />

      <Route exact path="/admin/dashboard">
        <BaseLayout>
          <AuthenticatedRouteGuard>
            <SystemRoleGuard
              validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
              fallback={<Redirect to="/forbidden" />}>
              <AdminDashboardRouter />
            </SystemRoleGuard>
          </AuthenticatedRouteGuard>
        </BaseLayout>
      </Route>

      <Route path="/admin/users">
        <BaseLayout>
          <AuthenticatedRouteGuard>
            <SystemRoleGuard
              validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
              fallback={<Redirect to="/forbidden" />}>
              <AdminUsersRouter />
            </SystemRoleGuard>
          </AuthenticatedRouteGuard>
        </BaseLayout>
      </Route>

      <RouteWithTitle path="/logout" title={getTitle('Logout')}>
        <BaseLayout>
          <AuthenticatedRouteGuard>
            <LogOutPage />
          </AuthenticatedRouteGuard>
        </BaseLayout>
      </RouteWithTitle>

      <Route path="/login">
        <UnAuthenticatedRouteGuard>
          <LoginPage />
        </UnAuthenticatedRouteGuard>
      </Route>

      <RouteWithTitle title="*" path="*">
        <Redirect to="/page-not-found" />
      </RouteWithTitle>
    </Switch>
  );
};

export default AppRouter;
