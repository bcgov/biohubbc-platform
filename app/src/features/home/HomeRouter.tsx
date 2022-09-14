import { Switch } from 'react-router';
import AppRoute from 'utils/AppRoute';
import HomePage from './HomePage';

/**
 * Router for all `/*` pages.
 *
 * @return {*}
 */
const HomeRouter: React.FC<React.PropsWithChildren> = () => {
  return (
    <Switch>
      <AppRoute exact path="/">
        <HomePage />
      </AppRoute>
    </Switch>
  );
};

export default HomeRouter;
