import { Redirect, Route, Switch } from 'react-router';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';
import DatasetPage from './DatasetPage';

/**
 * Router for all `/datasets/*` pages.
 *
 * @return {*}
 */
const DatasetsRouter: React.FC<React.PropsWithChildren> = () => {
  return (
    <Switch>
      <Redirect exact from="/datasets/:id" to="/datasets/:id/details" />

      {/* <RouteWithTitle exact path="/datasets" title={getTitle('Datasets')}>
        <DatasetListPage />
      </RouteWithTitle> */}

      <RouteWithTitle exact path="/datasets/:id/details" title={getTitle('Dataset Details')}>
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
