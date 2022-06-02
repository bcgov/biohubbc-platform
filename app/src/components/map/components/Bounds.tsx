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

export const GetMapBounds: React.FC<{ getOccurrenceData: (bounds: LatLngBounds) => void }> = (props) => {
  const { getOccurrenceData } = props;

  const map = useMapEvents({
    zoomend() {
      const bounds = map.getBounds();
      getOccurrenceData(bounds);
    },
    moveend() {
      const bounds = map.getBounds();
      getOccurrenceData(bounds);
    }
  });

  return null;
};
