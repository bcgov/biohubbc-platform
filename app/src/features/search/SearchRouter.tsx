import { Redirect, Route, Switch } from 'react-router';
import SearchPage from './SearchPage';
import { getTitle } from 'utils/Utils';
import RouteWithTitle from 'utils/RouteWithTitle';

/**
 * Router for all `/search/*` pages.
 *
 * @return {*}
 */
const SearchRouter: React.FC<React.PropsWithChildren> = () => {
  return (
    <Switch>
      <RouteWithTitle exact path="/search" title={getTitle('Search')}>
        <SearchPage />
      </RouteWithTitle>

      {/*  Catch any unknown routes, and re-direct to the not found page */}
      <Route path="/search/*">
        <Redirect to="/page-not-found" />
      </Route>
    </Switch>
  );
};

export default SearchRouter;
