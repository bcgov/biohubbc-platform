import { Switch } from 'react-router';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';
import SubmissionsListPage from './list/SubmissionsListPage';

/**
 * Router for all `/submissions/*` pages.
 *
 * @return {*}
 */
const SubmissionsRouter = () => {
  return (
    <Switch>
      <RouteWithTitle exact path="/" title={getTitle('Submissions')}>
        <SubmissionsListPage />
      </RouteWithTitle>
    </Switch>
  );
};

export default SubmissionsRouter;
