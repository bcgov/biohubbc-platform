import { Switch } from 'react-router';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';
import DatasetListPage from './SubmissionsListPage';

/**
 * Router for all `/submissions/*` pages.
 *
 * @return {*}
 */
const SubmissionsRouter = () => {
  return (
    <Switch>
      {/* <Redirect exact from="/datasets/:id" to="/submissions/:id/details" /> */}

      <RouteWithTitle exact path="/" title={getTitle('Submissions')}>
        <DatasetListPage />
      </RouteWithTitle>

    </Switch>
  );
};

export default SubmissionsRouter;
