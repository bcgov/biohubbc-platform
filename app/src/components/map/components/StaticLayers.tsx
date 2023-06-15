import * as L from 'leaflet';
import { ReactElement } from 'react';
import { FeatureGroup, GeoJSON, Popup, Tooltip } from 'react-leaflet';
import { IStaticLayersProps } from './StaticLayersControls';

// Compare with StaticLayersControl.tsx
// See that <LayersControl.Overlay> is removed here
// This allows the static layer data to render properly without the <LayerControl> component visible on the map
const StaticLayers: React.FC<React.PropsWithChildren<IStaticLayersProps>> = (props) => {
  if (!props.layers?.length) {
    return null;
  }

  const layerControls: ReactElement[] = [];

  props.layers.forEach((layer) => {
    if (!layer.features?.length) {
      return;
    }

    layerControls.push(
      <FeatureGroup key={`static-feature-group-${layer.layerName}`}>
        {layer.features.map((item, index) => {
          const id = item.key || item.geoJSON.id || index;

          return (
            <GeoJSON
              key={`static-feature-${id}`}
              pointToLayer={(feature, latlng) => {
                if (feature.properties?.radius) {
                  return new L.Circle([latlng.lat, latlng.lng], feature.properties.radius);
                }

                return new L.Marker([latlng.lat, latlng.lng]);
              }}
              data={item.geoJSON}
              {...item.GeoJSONProps}>
              {item.tooltip && (
                <Tooltip key={`static-feature-tooltip-${id}`} direction="top" {...item.TooltipProps}>
                  {item.tooltip}
                </Tooltip>
              )}
              {item.popup && (
                <Popup
                  key={`static-feature-popup-${id}`}
                  keepInView={false}
                  closeButton={false}
                  autoPan={false}
                  {...item.PopupProps}>
                  {item.popup}
                </Popup>
              )}
            </GeoJSON>
          );
        })}
      </FeatureGroup>
    );
  });

  return <>{layerControls}</>;
};

export default StaticLayers;
