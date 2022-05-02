import makeStyles from '@material-ui/core/styles/makeStyles';
import { Feature } from 'geojson';
import L, { LeafletEventHandlerFnMap } from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-fullscreen/dist/leaflet.fullscreen.css';
import 'leaflet-fullscreen/dist/Leaflet.fullscreen.js';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import React from 'react';
import { FeatureGroup, LayersControl, MapContainer as LeafletMapContainer } from 'react-leaflet';
import BaseLayerControls from './components/BaseLayerControls';
import MapBounds from './components/Bounds';
import DrawControls from './components/DrawControls';
import EventHandler from './components/EventHandler';
import FullScreenScrollingEventHandler from './components/FullScreenScrollingEventHandler';
import MarkerClusterGroup, { IMarker } from './components/MarkerCluster';
import StaticLayers, { IStaticLayer } from './components/StaticLayers';

const useStyles = makeStyles(() => ({
  map: {
    height: '100%'
  }
}));

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: iconShadow
});

export interface IMapDrawControlsProps {
  features?: Feature[];
  onChange?: (ref: any) => void;
}

export interface IMapContainerProps {
  mapId: string;
  staticLayers?: IStaticLayer[];
  drawControls?: IMapDrawControlsProps;
  scrollWheelZoom?: boolean;
  fullScreenControl?: boolean;
  markers?: IMarker[];
  bounds?: any;
  zoom?: number;
  eventHandlers?: LeafletEventHandlerFnMap;
  LeafletMapContainerProps?: Partial<React.ComponentProps<typeof LeafletMapContainer>>;
}

const MapContainer: React.FC<IMapContainerProps> = (props) => {
  const classes = useStyles();

  const {
    mapId,
    staticLayers,
    drawControls,
    scrollWheelZoom,
    fullScreenControl,
    markers,
    bounds,
    zoom,
    eventHandlers,
    LeafletMapContainerProps
  } = props;

  const fullscreenControlProp = (fullScreenControl && { pseudoFullscreen: true }) || undefined;

  return (
    <LeafletMapContainer
      id={mapId}
      className={classes.map}
      center={[55, -128]}
      zoom={zoom || 5}
      minZoom={3}
      maxZoom={17}
      maxBounds={[
        [-90, -180],
        [90, 180]
      ]}
      maxBoundsViscosity={1}
      fullscreenControl={fullscreenControlProp}
      {...LeafletMapContainerProps}>
      <FullScreenScrollingEventHandler bounds={bounds} scrollWheelZoom={scrollWheelZoom || false} />

      <MapBounds bounds={bounds} />

      {drawControls && (
        <FeatureGroup>
          <DrawControls
            features={props.drawControls?.features}
            onChange={(features: Feature[]) => {
              props.drawControls?.onChange?.(features);
            }}
            options={{ draw: { circlemarker: false } }}
          />
        </FeatureGroup>
      )}

      <MarkerClusterGroup markers={markers} />

      <EventHandler eventHandlers={eventHandlers} />

      <LayersControl position="bottomright">
        <StaticLayers layers={staticLayers} />

        <BaseLayerControls />
      </LayersControl>
    </LeafletMapContainer>
  );
};

export default MapContainer;
