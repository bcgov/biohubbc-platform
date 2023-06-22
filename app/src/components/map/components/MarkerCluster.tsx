import 'leaflet.markercluster';
import { ReactElement } from 'react';
import { FeatureGroup, Popup, Tooltip } from 'react-leaflet';
import { IMarkerLayersProps, Marker } from './MarkerClusterControls';

// Compare with MarkerClusterControls.tsx
// See that <LayersControl.Overlay> is removed here
// This allows the marker data to render properly without the <LayerControl> component visible on the map
const MarkerCluster: React.FC<React.PropsWithChildren<IMarkerLayersProps>> = (props) => {
  if (!props.layers?.length) {
    return null;
  }

  const layerControls: ReactElement[] = [];

  props.layers.forEach((layer, index) => {
    if (!layer.markers?.length) {
      return;
    }

    layerControls.push(
      <FeatureGroup>
        {layer.markers.map((item) => {
          const id = item.key;
          return (
            <Marker
              count={item.count || 0}
              key={`marker-cluster-${id}`}
              position={[item.position[1], item.position[0]]}
              {...item.MarkerProps}>
              {item.tooltip && (
                <Tooltip key={`marker-cluster-tooltip-${id}`} direction="top" {...item.TooltipProps}>
                  {item.tooltip}
                </Tooltip>
              )}
              {item.popup && (
                <Popup
                  key={`marker-cluster-popup-${id}`}
                  keepInView={false}
                  closeButton={false}
                  autoPan={false}
                  {...item.PopupProps}>
                  {item.popup}
                </Popup>
              )}
            </Marker>
          );
        })}
      </FeatureGroup>
    );
  });

  return <>{layerControls}</>;
};

export default MarkerCluster;
