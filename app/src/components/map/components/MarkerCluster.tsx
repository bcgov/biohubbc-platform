import L, { LatLngExpression } from 'leaflet';
import React, { ReactElement } from 'react';
import { LayersControl, Marker, MarkerProps, Popup, PopupProps, Tooltip, TooltipProps } from 'react-leaflet';
import { default as ReactLeafletMarkerClusterGroup } from 'react-leaflet-cluster';

const MARKER_SVG = {
  DOT: '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20"><path fill="{color}" d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2z"/></svg>'
};

export const MARKER_ICON = {
  DOT: L.divIcon({
    className: 'leaflet-data-marker',
    html: L.Util.template(MARKER_SVG.DOT, { color: '#2F5982' }),
    iconAnchor: [10, 10],
    iconSize: [20, 20],
    popupAnchor: [0, -10]
  })
};

export interface IMarker {
  position: LatLngExpression;
  key?: string | number;
  MarkerProps?: Partial<MarkerProps>;
  popup?: ReactElement;
  PopupProps?: Partial<PopupProps>;
  tooltip?: ReactElement;
  TooltipProps?: Partial<TooltipProps>;
}

export interface IMarkerLayer {
  layerName: string;
  markers: IMarker[];
}

export interface IMarkerLayersProps {
  layers?: IMarkerLayer[];
}

const MarkerClusterGroup: React.FC<React.PropsWithChildren<IMarkerLayersProps>> = (props) => {
  if (!props.layers?.length) {
    return null;
  }

  const layerControls: ReactElement[] = [];

  props.layers.forEach((layer) => {
    if (!layer.markers?.length) {
      return;
    }

    layerControls.push(
      <LayersControl.Overlay checked name={layer.layerName} key={`marker-layer-${layer.layerName}`}>
        <ReactLeafletMarkerClusterGroup chunkedLoading>
          {layer.markers.map((item, index: number) => {
            const id = item.key || index;

            return (
              <Marker
                icon={MARKER_ICON.DOT}
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
        </ReactLeafletMarkerClusterGroup>
      </LayersControl.Overlay>
    );
  });

  return <>{layerControls}</>;
};

export default MarkerClusterGroup;
