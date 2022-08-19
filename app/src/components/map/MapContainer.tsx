import { makeStyles } from '@mui/styles';
import { MAP_DEFAULT_ZOOM, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from 'constants/spatial';
import L, { LatLngBoundsExpression, LeafletEventHandlerFnMap } from 'leaflet';
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
import { GetMapBounds, IMapBoundsOnChange, SetMapBounds } from './components/Bounds';
import DrawControls, { IDrawControlsOnChange, IDrawControlsProps } from './components/DrawControls';
import EventHandler from './components/EventHandler';
import FullScreenScrollingEventHandler from './components/FullScreenScrollingEventHandler';
import MarkerClusterGroup, { IMarkerLayer } from './components/MarkerCluster';
import StaticLayers, { IStaticLayer } from './components/StaticLayers';
import UploadControls from './components/UploadControls';

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

export interface IMapContainerProps {
  mapId: string;
  staticLayers?: IStaticLayer[];
  drawControls?: IDrawControlsProps;
  onDrawChange?: IDrawControlsOnChange;
  scrollWheelZoom?: boolean;
  fullScreenControl?: boolean;
  markerLayers?: IMarkerLayer[];
  bounds?: LatLngBoundsExpression;
  zoom?: number;
  eventHandlers?: LeafletEventHandlerFnMap;
  LeafletMapContainerProps?: Partial<React.ComponentProps<typeof LeafletMapContainer>>;
  onBoundsChange?: IMapBoundsOnChange;
}

const MapContainer: React.FC<React.PropsWithChildren<IMapContainerProps>> = (props) => {
  const classes = useStyles();

  const {
    mapId,
    staticLayers,
    drawControls,
    onDrawChange,
    scrollWheelZoom,
    fullScreenControl,
    markerLayers,
    bounds,
    zoom,
    eventHandlers,
    LeafletMapContainerProps,
    onBoundsChange
  } = props;

  const fullscreenControlProp = (fullScreenControl && { pseudoFullscreen: true }) || undefined;

  return (
    <LeafletMapContainer
      id={mapId}
      className={classes.map}
      center={[55, -128]}
      zoom={zoom || MAP_DEFAULT_ZOOM}
      minZoom={MAP_MIN_ZOOM}
      maxZoom={MAP_MAX_ZOOM}
      maxBounds={[
        [-90, -180],
        [90, 180]
      ]}
      maxBoundsViscosity={1}
      fullscreenControl={fullscreenControlProp}
      {...LeafletMapContainerProps}>
      <FullScreenScrollingEventHandler bounds={bounds} scrollWheelZoom={scrollWheelZoom || false} />

      <SetMapBounds bounds={bounds} />
      <GetMapBounds onChange={(newBounds, newZoom) => onBoundsChange?.(newBounds, newZoom)} />

      {drawControls && (
        <FeatureGroup key="draw-control-feature-group">
          <DrawControls
            {...props.drawControls}
            options={{
              ...props.drawControls?.options,
              draw: { ...props.drawControls?.options?.draw, circlemarker: false } // Always disable circlemarker
            }}
            onChange={onDrawChange}
          />
        </FeatureGroup>
      )}
      <UploadControls />

      <EventHandler eventHandlers={eventHandlers} />

      <LayersControl position="bottomright">
        <StaticLayers layers={staticLayers} />

        <MarkerClusterGroup layers={markerLayers} />

        <BaseLayerControls />
      </LayersControl>
    </LeafletMapContainer>
  );
};

export default MapContainer;
