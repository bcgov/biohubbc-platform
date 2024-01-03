import { SubmissionContextProvider } from 'contexts/submissionContext';
import AdminSubmissionPage from 'features/submissions/AdminSubmissionPage';
import { Switch } from 'react-router';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';
import DashboardPage from './DashboardPage';

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

      <RouteWithTitle exact path="/admin/dashboard/submissions/:submission_id" title={getTitle('Submission Review')}>
        <SubmissionContextProvider>
          <AdminSubmissionPage />
        </SubmissionContextProvider>
      </RouteWithTitle>
    </Switch>
  );
};

export default AdminDashboardRouter;
