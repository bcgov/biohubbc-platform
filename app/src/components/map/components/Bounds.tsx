import { LatLngBoundsExpression } from 'leaflet';
import { useMap, useMapEvents } from 'react-leaflet';

export interface IMapBoundsProps {
  bounds?: LatLngBoundsExpression;
  getOccurrenceData?: any;
}

const MapBounds: React.FC<IMapBoundsProps> = (props) => {
  const map = useMap();

  if (props.bounds) {
    map.fitBounds(props.bounds, { padding: [30, 30] });
  }

  return null;
};

export const GetMapBounds: React.FC<IMapBoundsProps> = (props) => {
  const { getOccurrenceData } = props;

  const map = useMapEvents({
    zoom() {
      const bounds = map.getBounds();
      getOccurrenceData(bounds);
    }
  });


  return null;
};

export default MapBounds;
