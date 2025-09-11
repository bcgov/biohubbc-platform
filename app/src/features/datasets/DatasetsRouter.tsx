import { Redirect, Route, Switch } from 'react-router';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';
import DatasetPage from './DatasetPage';

/**
 * Router for all `/datasets/*` pages.
 *
 * @return {*}
 */
const DatasetsRouter = () => {
  return (
    <Switch>
      <Redirect exact from="/:id" to="/:id/details" />

      <RouteWithTitle exact path="/:id/details" title={getTitle('Dataset Details')}>
        <DatasetPage />
      </RouteWithTitle>

      {/*  Catch any unknown routes, and re-direct to the not found page */}
      <Route path="/*">
        <Redirect to="/page-not-found" />
      </Route>
    </Switch>
  );
};

export default DatasetsRouter;
