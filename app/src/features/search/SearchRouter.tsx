import BaseLayout from 'layouts/BaseLayout';
import React from 'react';
import { Redirect, Switch } from 'react-router';
import AppRoute from 'utils/AppRoute';
import SearchPage from './SearchPage';

/**
 * Router for all `/*` pages.
 *
 * @return {*}
 */
const SearchRouter: React.FC = () => {
  return (
    <Switch>
      <AppRoute exact path="/search" layout={BaseLayout}>
        <SearchPage />
      </AppRoute>

      {/*  Catch any unknown routes, and re-direct to the not found page */}
      <AppRoute path="/search/*">
        <Redirect to="/page-not-found" />
      </AppRoute>
    </Switch>
  );
};

export default SearchRouter;
