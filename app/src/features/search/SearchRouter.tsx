import { Redirect, Switch } from 'react-router';
import AppRoute from 'utils/AppRoute';
import SearchPage from './SearchPage';

/**
 * Router for all `/search/*` pages.
 *
 * @return {*}
 */
const SearchRouter: React.FC<React.PropsWithChildren> = () => {
  return (
    <Switch>
      <AppRoute exact path="/search">
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
