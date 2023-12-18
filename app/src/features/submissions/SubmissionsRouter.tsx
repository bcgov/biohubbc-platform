import { Redirect, Route, Switch } from 'react-router';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';
import SubmissionsListPage from './SubmissionsListPage';

/**
 * Router for all `/submissions/*` pages.
 *
 * @return {*}
 */
const SubmissionsRouter = () => {
  return (
    <Switch>
      {/* <Redirect exact from="/datasets/:id" to="/submissions/:id/details" /> */}

      <RouteWithTitle exact path="/submissions" title={getTitle('Submissions')}>
        <SubmissionsListPage />
      </RouteWithTitle>

      {/*  Catch any unknown routes, and re-direct to the not found page */}
      <Route path="/submissions/*">
        <Redirect to="/page-not-found" />
      </Route>
    </Switch>
  );
};

export default SubmissionsRouter;
