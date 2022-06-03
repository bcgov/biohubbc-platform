import ContentLayout from 'layouts/ContentLayout';
import React from 'react';
import { Switch } from 'react-router';
import AppRoute from 'utils/AppRoute';
import MapPage from './MapPage';

/**
 * Router for all `/map` pages.
 *
 * @return {*}
 */
const MapRouter: React.FC = () => {
  return (
    <Switch>
      <AppRoute exact path="/map" layout={ContentLayout}>
        <MapPage />
      </AppRoute>
    </Switch>
  );
};

export default MapRouter;
