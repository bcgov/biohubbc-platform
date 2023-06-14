import { Redirect, Route, Switch } from 'react-router';
import DatasetPage from './DatasetPage';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';

/**
 * Router for all `/datasets/*` pages.
 *
 * @return {*}
 */
const DatasetsRouter: React.FC<React.PropsWithChildren> = () => {
  return (
    <Switch>
      <Redirect exact from="/datasets/:id" to="/datasets/:id/details" />

      <RouteWithTitle exact path="/datasets/:id/details" title={getTitle('Datasets')}>
        <DatasetPage />
      </RouteWithTitle>

      {/*  Catch any unknown routes, and re-direct to the not found page */}
      <Route path="/datasets/*">
        <Redirect to="/page-not-found" />
      </Route>
    </Switch>
  );
};

export default DatasetsRouter;
