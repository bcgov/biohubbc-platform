import { Feature, Polygon } from 'geojson';
import { LatLngBoundsExpression } from 'leaflet';
import { useMap, useMapEvents } from 'react-leaflet';
import { getFeatureObjectFromLatLngBounds } from 'utils/Utils';

export interface ISetMapBoundsProps {
  bounds?: LatLngBoundsExpression;
}

export const SetMapBounds: React.FC<ISetMapBoundsProps> = (props) => {
  const map = useMap();

  if (props.bounds) {
    map.fitBounds(props.bounds, { padding: [30, 30] });
  }

  return null;
};

export type IMapBoundsOnChange = (bounds: Feature<Polygon>) => void;

export interface IGetMapBoundsProps {
  onChange: IMapBoundsOnChange;
}

export const GetMapBounds: React.FC<IGetMapBoundsProps> = (props) => {
  const { onChange } = props;

  const map = useMapEvents({
    zoomend() {
      const latLngBounds = map.getBounds();
      map.closePopup();

      const featureBounds = getFeatureObjectFromLatLngBounds(latLngBounds);

      onChange(featureBounds);
    },
    moveend() {
      const latLngBounds = map.getBounds();
      map.closePopup();

      const featureBounds = getFeatureObjectFromLatLngBounds(latLngBounds);

      onChange(featureBounds);
    }
  });

  return null;
};
