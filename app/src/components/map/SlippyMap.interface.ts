import type { SxProps, Theme } from '@mui/material/styles';
import type { Feature } from 'geojson';
import type { MapOptions, StyleSpecification } from 'maplibre-gl';

/**
 * Draw modes supported by the `SlippyMap` drawing toolbar, one per supported GeoJSON geometry type.
 */
export type SlippyMapDrawMode = 'point' | 'linestring' | 'polygon';

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
   * Styling for the map container. The consumer is responsible for providing a height.
   */
  sx?: SxProps<Theme>;
}
