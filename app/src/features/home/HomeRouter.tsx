import BaseLayout from 'layouts/BaseLayout';
import React from 'react';
import { Switch } from 'react-router';
import AppRoute from 'utils/AppRoute';
import HomePage from './HomePage';

/**
 * Router for all `/*` pages.
 *
 * @return {*}
 */
const HomeRouter: React.FC = () => {
  return (
    <Switch>
      <AppRoute exact path="/" layout={BaseLayout}>
        <HomePage />
      </AppRoute>
    </Switch>
  );
};

export default HomeRouter;
