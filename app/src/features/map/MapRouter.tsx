import { Switch } from 'react-router';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';
import MapPage from './MapPage';

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
