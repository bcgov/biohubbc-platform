import L, { LatLngExpression } from 'leaflet';
import React, { ReactElement } from 'react';
import { Marker } from 'react-leaflet';
import { default as ReactLeafletMarkerClusterGroup } from 'react-leaflet-cluster';
export interface IMarker {
  position: LatLngExpression;
  popup?: ReactElement;
}

export interface IMarkerClusterProps {
  markers?: IMarker[];
}

const MarkerClusterGroup: React.FC<IMarkerClusterProps> = (props) => {
  if (!props.markers?.length) {
    return null;
  }

  //TODO needs improvment for dynamic icons and colours
  const iconSettings = {
    mapIconUrl:
      '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M0 0h24v24H0z" fill="none"/><path fill="#2F5982" d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2z"/></svg>',
    pinInnerCircleRadius: 48
  };

  // icon normal state
  const divIcon = L.divIcon({
    className: 'leaflet-data-marker',
    html: L.Util.template(iconSettings.mapIconUrl, iconSettings),
    iconAnchor: [12, 32],
    iconSize: [25, 30],
    popupAnchor: [0, -28]
  });



  return (
    <ReactLeafletMarkerClusterGroup chunkedLoading>
      {props.markers.map((item, index: number) => (
        // Reverse the position (coordinates) from [lng, lat] to [lat, lng]
        <Marker icon={divIcon} key={index} position={[item.position[1], item.position[0]]}>
          {item.popup}
        </Marker>
      ))}
    </ReactLeafletMarkerClusterGroup>
  );
};

export default MarkerClusterGroup;
