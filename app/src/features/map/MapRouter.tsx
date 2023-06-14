import { Switch } from 'react-router';
import MapPage from './MapPage';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';

/**
 * Router for all `/map` pages.
 *
 * @return {*}
 */
const MapRouter: React.FC<React.PropsWithChildren> = () => {
  return (
    <Switch>
      <RouteWithTitle exact path="/map" title={getTitle('Map')}>
        <MapPage />
      </RouteWithTitle>
    </Switch>
  );
};

export default MapRouter;
