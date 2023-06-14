import { Switch } from 'react-router';
import HomePage from './HomePage';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';

/**
 * Router for all `/*` pages.
 *
 * @return {*}
 */
const HomeRouter: React.FC<React.PropsWithChildren> = () => {
  return (
    <Switch>
      <RouteWithTitle exact path="/" title={getTitle('Home')}>
        <HomePage />
      </RouteWithTitle>
    </Switch>
  );
};

export default HomeRouter;
