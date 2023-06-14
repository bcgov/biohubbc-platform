import { Switch } from 'react-router';
import DashboardPage from './DashboardPage';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';

/**
 * Router for all `/*` pages.
 *
 * @return {*}
 */
const AdminDashboardRouter: React.FC<React.PropsWithChildren> = () => {
  return (
    <Switch>
      <RouteWithTitle exact path="/admin/dashboard" title={getTitle('Dashboard')}>
        <DashboardPage />
      </RouteWithTitle>
    </Switch>
  );
};

export default AdminDashboardRouter;
