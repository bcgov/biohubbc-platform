import { Switch } from 'react-router';
import AppRoute from 'utils/AppRoute';
import DashboardPage from './DashboardPage';

/**
 * Router for all `/*` pages.
 *
 * @return {*}
 */
const AdminDashboardRouter: React.FC<React.PropsWithChildren> = () => {
  return (
    <Switch>
      <AppRoute exact path="/admin/dashboard">
        <DashboardPage />
      </AppRoute>
    </Switch>
  );
};

export default AdminDashboardRouter;
