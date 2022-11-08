import { Redirect, Switch } from 'react-router';
import AppRoute from 'utils/AppRoute';
import DatasetPage from './DatasetPage';

/**
 * Router for all `/datasets/*` pages.
 *
 * @return {*}
 */
const datasetsRouter: React.FC<React.PropsWithChildren> = () => {
  return (
    <Switch>
      <AppRoute exact path="/datasets/:id/details">
        <DatasetPage />
      </AppRoute>

      {/*  Catch any unknown routes, and re-direct to the not found page */}
      <AppRoute path="/datasets/*">
        <Redirect to="/page-not-found" />
      </AppRoute>
    </Switch>
  );
};

export default datasetsRouter;
