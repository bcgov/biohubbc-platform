import type { MapGeoJSONFeature } from 'maplibre-gl';
import { CLUSTER_LAYER_ID } from './map-layers';

/**
 * A server-side cluster of mapped locations selected on the map.
 *
 * The only selectable thing on the map: geometry tiles carry no attributes, so an individual shape
 * has nothing a click could resolve.
 */
export interface ClusterMapSelection {
  kind: 'cluster';
  /**
   * How many locations the cluster stands for. A result recorded in several places contributes one
   * per place, matching what is drawn once the map is zoomed in far enough to show them.
   */
  locationCount: number;
}

export type MapSelection = ClusterMapSelection;

/**
 * Interpret a rendered tile feature as a map selection.
 *
 * A cluster is recognised by the layer that rendered it — the cluster layer is the map's only
 * interactive layer — and carries `location_count`, its size. Anything else, including a cluster
 * missing its count, returns null and is ignored, so a malformed tile can never break the page.
 *
 * @param {MapGeoJSONFeature} feature Clicked feature, as the map's hit test returns it.
 * @return {*}  {(MapSelection | null)}
 */
export const resolveMapSelection = (feature: MapGeoJSONFeature): MapSelection | null => {
  if (feature.layer?.id !== CLUSTER_LAYER_ID) {
    return null;
  }

  const locationCount = Number(feature.properties?.location_count);

  if (!locationCount || locationCount < 1) {
    return null;
  }

  return {
    kind: 'cluster',
    locationCount
  };
};
