import { Switch } from 'react-router';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';
import ManageSecurityRulesPage from './ManageSecurityRulesPage';

/**
 * Router for all `/*` pages.
 *
 * @return {*}
 */
const AdminDashboardRouter: React.FC<React.PropsWithChildren> = () => {
  return (
    <Switch>
      <RouteWithTitle exact path="/admin/security" title={getTitle('Dashboard')}>
        <ManageSecurityRulesPage />
      </RouteWithTitle>
    </Switch>
  );
};

export default AdminDashboardRouter;
