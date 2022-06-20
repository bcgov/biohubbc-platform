import ContentLayout from 'layouts/ContentLayout';
import React from 'react';
import { Redirect, Switch } from 'react-router';
import AppRoute from 'utils/AppRoute';
import DatasetsPage from './DatasetsPage';

/**
 * Router for all `/search/*` pages.
 *
 * @return {*}
 */
const datasetsRouter: React.FC = () => {
  return (
    <Switch>
      <AppRoute exact path="/datasets" layout={ContentLayout}>
        <DatasetsPage />
      </AppRoute>

      {/*  Catch any unknown routes, and re-direct to the not found page */}
      <AppRoute path="/datasets/*">
        <Redirect to="/page-not-found" />
      </AppRoute>
    </Switch>
  );
};

export default datasetsRouter;
