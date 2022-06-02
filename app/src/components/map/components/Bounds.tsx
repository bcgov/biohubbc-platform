import { LatLngBounds, LatLngBoundsExpression } from 'leaflet';
import { useMap, useMapEvents } from 'react-leaflet';

export interface IMapBoundsProps {
  bounds?: LatLngBoundsExpression;
}

export const SetMapBounds: React.FC<IMapBoundsProps> = (props) => {
  const map = useMap();

  if (props.bounds) {
    map.fitBounds(props.bounds, { padding: [30, 30] });
  }

  return null;
};

export const GetMapBounds: React.FC<{ onChange: (bounds: LatLngBounds) => void }> = (props) => {
  const { onChange } = props;

  const map = useMapEvents({
    zoomend() {
      const bounds = map.getBounds();
      map.closePopup()
      onChange(bounds);
    },
    moveend() {
      const bounds = map.getBounds();
      map.closePopup()
      onChange(bounds);
    }
  });

  return null;
};
