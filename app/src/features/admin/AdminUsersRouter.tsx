import ContentLayout from 'layouts/ContentLayout';
import React from 'react';
import { Redirect, Switch } from 'react-router';
import AppRoute from 'utils/AppRoute';
import ManageUsersPage from './users/ManageUsersPage';

/**
 * Router for all `/admin/users/*` pages.
 *
 * @return {*}
 */
const AdminUsersRouter: React.FC<React.PropsWithChildren> = () => {
  return (
    <Switch>
      <AppRoute exact path="/admin/users" layout={ContentLayout}>
        <ManageUsersPage />
      </AppRoute>

      {/*  Catch any unknown routes, and re-direct to the not found page */}
      <AppRoute path="/admin/users/*">
        <Redirect to="/page-not-found" />
      </AppRoute>
    </Switch>
  );
};

export default AdminUsersRouter;
