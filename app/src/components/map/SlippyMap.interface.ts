import type { SxProps, Theme } from '@mui/material/styles';
import type { Feature } from 'geojson';
import type { ReactNode, Ref } from 'react';
import type {
  LayerSpecification,
  MapGeoJSONFeature,
  MapOptions,
  RequestTransformFunction,
  SourceSpecification,
  StyleSpecification
} from 'maplibre-gl';

/**
 * Draw modes supported by the `SlippyMap` drawing toolbar, one per supported GeoJSON geometry type.
 */
export type SlippyMapDrawMode = 'point' | 'linestring' | 'polygon';

/**
 * Where a map click landed: `point` in container-relative screen pixels (suitable for anchoring an overlay inside
 * the map container), `lngLat` in geographic coordinates.
 */
export interface MapClickPosition {
  point: { x: number; y: number };
  lngLat: { lng: number; lat: number };
}

/**
 * Imperative camera handle exposed through the component ref. Deliberately narrow: the map instance itself stays
 * inside the component.
 */
export interface SlippyMapHandle {
  /**
   * Smoothly move the camera. `zoom` is absolute and left unchanged when omitted.
   */
  easeTo: (options: { center: [number, number]; zoom?: number }) => void;
  /**
   * Current zoom level, or undefined before the map exists.
   */
  getZoom: () => number | undefined;
}

/**
 * What a layer's `popupRender` is given: the clicked feature, where its popup is anchored, and the means to close it
 * or move the camera. Everything a popup needs, so a consumer never needs the map itself to render one.
 */
export interface ISlippyMapPopupContext extends SlippyMapHandle {
  /**
   * The clicked feature, carrying its id, properties, source and layer information.
   */
  feature: MapGeoJSONFeature;
  /**
   * Where the popup is anchored, geographically. The map keeps the popup over this position as the camera moves.
   */
  lngLat: MapClickPosition['lngLat'];
  /**
   * Dismiss the popup.
   */
  close: () => void;
}

/**
 * A layer to render, together with how it responds to a click.
 *
 * Styling and behaviour travel together so a layer cannot be made interactive in one prop and styled in another. A
 * layer declaring neither `onClick` nor `popupRender` is display-only: it takes no part in hit testing and shows no
 * pointer cursor.
 */
export interface ISlippyMapLayer {
  /**
   * The MapLibre layer. Its `source` must name an entry in `tileSources`.
   */
  specification: LayerSpecification;
  /**
   * Fired when a rendered feature in this layer is clicked. Where layers overlap, the topmost rendered feature wins.
   *
   * Receives the clicked position as well, so an overlay can be anchored to it.
   */
  onClick?: (feature: MapGeoJSONFeature, position: MapClickPosition) => void;
  /**
   * Renders the popup for a clicked feature in this layer.
   *
   * The map owns everything about the popup except its content: it is anchored to the clicked geography and tracks it
   * as the camera moves, and it is dismissed by an empty-map click, `Escape`, a click on another feature, or `close`.
   * Return null to show no popup for this feature, which is how a consumer rejects one it cannot describe.
   */
  popupRender?: (context: ISlippyMapPopupContext) => ReactNode;
}

/**
 * Configures which drawing controls the `SlippyMap` toolbar exposes.
 */
export interface ISlippyMapDrawControls {
  /**
   * Enable the draw point control.
   */
  point?: boolean;
  /**
   * Enable the draw line string control.
   */
  lineString?: boolean;
  /**
   * Enable the draw polygon control.
   */
  polygon?: boolean;
  /**
   * Enable the trash control, which deletes the currently selected feature.
   */
  trash?: boolean;
}

export interface ISlippyMapProps {
  /**
   * Optional ref receiving the imperative camera handle.
   */
  ref?: Ref<SlippyMapHandle>;
  /**
   * Optional id applied to the map container element.
   */
  id?: string;
  /**
   * Initial map center as `[longitude, latitude]`. Applied on mount only. Defaults to `[0, 0]`.
   */
  initialCenter?: [number, number];
  /**
   * Initial map zoom level. Applied on mount only. Defaults to `0`.
   */
  initialZoom?: number;
  /**
   * Map style url or style specification. Applied on mount only. Defaults to a blank neutral style that makes no
   * external network requests.
   */
  mapStyle?: string | StyleSpecification;
  /**
   * Escape hatch for additional MapLibre map display options. Applied on mount only.
   */
  mapOptions?: Omit<MapOptions, 'container' | 'style' | 'center' | 'zoom'>;
  /**
   * Features to display on the map. Supports `Point`, `LineString`, and `Polygon` geometries; features with other
   * geometry types are skipped.
   *
   * The features are controlled: persist the features emitted by the `onDraw*` callbacks (they include stable ids)
   * and pass them back via this prop.
   */
  features?: Feature[];
  /**
   * Which drawing controls to expose. Omit (or set all controls to `false`) for a display-only map.
   */
  drawControls?: ISlippyMapDrawControls;
  /**
   * When true, all create/update/delete interactions are disabled and the drawing toolbar is hidden.
   */
  readOnly?: boolean;
  /**
   * Fired when drawing a new feature completes. Receives only the newly created feature(s).
   */
  onDrawCreate?: (createdFeatures: Feature[]) => void;
  /**
   * Fired when a feature edit completes (feature dragged, vertex moved/inserted/deleted, etc). Receives the full
   * post-update feature set.
   */
  onDrawUpdate?: (updatedFeatures: Feature[]) => void;
  /**
   * Fired when feature(s) are deleted (trash control or keyboard `Delete`). Receives the full remaining feature set.
   */
  onDrawDelete?: (remainingFeatures: Feature[]) => void;
  /**
   * Map sources to display, keyed by source id. Applied once the map has loaded, and replaced when this prop changes.
   *
   * Generic on purpose: the map treats these as opaque MapLibre sources and knows nothing about what they contain, so
   * concerns like session creation, authorization and refresh stay with the consumer.
   */
  tileSources?: Record<string, SourceSpecification>;
  /**
   * Layers to render, in draw order (first is drawn lowest). Applied and replaced alongside `tileSources`.
   */
  layers?: ISlippyMapLayer[];
  /**
   * Hook applied to every request the map makes, used to attach headers such as `Authorization`.
   *
   * The latest function is always used, including for requests made long after mount, so a consumer can rotate a
   * short-lived credential without rebuilding the map.
   */
  transformRequest?: RequestTransformFunction;
  /**
   * Fired when the map is clicked and no interactive feature is under the cursor, so a consumer can dismiss
   * anything anchored to a previous selection.
   */
  onEmptyMapClick?: (position: MapClickPosition) => void;
  /**
   * Fired once the map style has loaded and any sources/layers have been applied.
   */
  onMapLoad?: () => void;
  /**
   * Fired when one of the applied sources fails to load, e.g. because a tile request was rejected. Lets the consumer
   * react to an expired credential, which `transformRequest` cannot observe because it never sees responses.
   */
  onSourceError?: (sourceId: string, error: unknown) => void;
  /**
   * Styling for the map container. The consumer is responsible for providing a height.
   */
  sx?: SxProps<Theme>;
}
