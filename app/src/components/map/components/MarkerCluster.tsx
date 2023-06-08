import { createLayerComponent } from '@react-leaflet/core';
import L from 'leaflet';
import 'leaflet.markercluster';
import { ReactElement } from 'react';
import { FeatureGroup, MarkerProps, Popup, Tooltip } from 'react-leaflet';
import { CountMarker, IMarkerLayersProps } from './MarkerClusterControls';

const Marker = createLayerComponent<L.Marker & { setCount: (count: number) => void }, MarkerProps & { count: number }>(
  ({ position, ...options }: MarkerProps & { count: number }, ctx) => {
    const instance = new CountMarker(position, options);
    return {
      instance,
      context: { ...ctx, overlayContainer: instance }
    };
  },
  (marker, props, prevProps) => {
    if (props.count !== prevProps.count) {
      marker.setCount(props.count);
    }
    if (props.position !== prevProps.position) {
      marker.setLatLng(props.position);
    }

    if (props.icon != null && props.icon !== prevProps.icon) {
      marker.setIcon(props.icon);
    }

    if (props.zIndexOffset != null && props.zIndexOffset !== prevProps.zIndexOffset) {
      marker.setZIndexOffset(props.zIndexOffset);
    }

    if (props.opacity != null && props.opacity !== prevProps.opacity) {
      marker.setOpacity(props.opacity);
    }

    if (marker.dragging != null && props.draggable !== prevProps.draggable) {
      if (props.draggable === true) {
        marker.dragging.enable();
      } else {
        marker.dragging.disable();
      }
    }
  }
);

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
