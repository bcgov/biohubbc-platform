import { SYSTEM_ROLE } from 'constants/roles';
import AccessDenied from 'features/403/AccessDenied';
import NotFoundPage from 'features/404/NotFoundPage';
import AdminUsersRouter from 'features/admin/AdminUsersRouter';
import AdminDashboardRouter from 'features/admin/dashboard/AdminDashboardRouter';
import DatasetsRouter from 'features/datasets/DatasetsRouter';
import SubmissionsRouter from 'features/submissions/SubmissionsRouter';
import { SystemRoleGuard } from 'guards/Guards';
import { AuthenticatedRouteGuard } from 'guards/RouteGuards';
import BaseLayout from 'layouts/BaseLayout';
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
          <SubmissionsRouter />
        </BaseLayout>
      </Route>

      <Route path="/datasets">
        <BaseLayout>
          <DatasetsRouter />
        </BaseLayout>
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

      <Route path="/admin/dashboard">
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

      <RouteWithTitle title="*" path="*">
        <Redirect to="/page-not-found" />
      </RouteWithTitle>
    </Switch>
  );
};

export default AppRouter;
