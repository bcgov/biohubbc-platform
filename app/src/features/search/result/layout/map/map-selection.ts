import type { MapGeoJSONFeature } from 'maplibre-gl';
import { CLUSTER_LAYER_ID } from './map-layers';

/**
 * A server-side cluster of search results selected on the map.
 *
 * The only selectable thing on the map: feature tiles are geometry only, so an individual result
 * carries nothing a click could resolve.
 */
export interface ClusterMapSelection {
  kind: 'cluster';
  featureCount: number;
}

export type MapSelection = ClusterMapSelection;

/**
 * Interpret a rendered tile feature as a map selection.
 *
 * A cluster is recognised by the layer that rendered it — the cluster layer is the map's only
 * interactive layer — and carries `feature_count`, its size. Anything else, including a cluster
 * missing its count, returns null and is ignored, so a malformed tile can never break the page.
 *
 * @param {MapGeoJSONFeature} feature Clicked feature, as the map's hit test returns it.
 * @return {*}  {(MapSelection | null)}
 */
export const resolveMapSelection = (feature: MapGeoJSONFeature): MapSelection | null => {
  if (feature.layer?.id !== CLUSTER_LAYER_ID) {
    return null;
  }

  const featureCount = Number(feature.properties?.feature_count);

  if (!featureCount || featureCount < 1) {
    return null;
  }

  return {
    kind: 'cluster',
    featureCount
  };
};
