import ContentLayout from 'layouts/ContentLayout';
import React from 'react';
import { Redirect, Switch } from 'react-router';
import AppRoute from 'utils/AppRoute';
import SubmissionsPage from './SubmissionsPage';

/**
 * Router for all `/search/*` pages.
 *
 * @return {*}
 */
const SubmissionsRouter: React.FC = () => {
  return (
    <Switch>
      <AppRoute exact path="/submissions" layout={ContentLayout}>
        <SubmissionsPage />
      </AppRoute>

      {/*  Catch any unknown routes, and re-direct to the not found page */}
      <AppRoute path="/submissions/*">
        <Redirect to="/page-not-found" />
      </AppRoute>
    </Switch>
  );
};

export default SubmissionsRouter;
