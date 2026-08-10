import type { MapClickPosition } from 'components/map/SlippyMap.interface';
import type { MapGeoJSONFeature } from 'maplibre-gl';

/**
 * An individual search result selected on the map.
 */
export interface FeatureMapSelection {
  kind: 'feature';
  submissionId: number;
  submissionFeatureId: number;
  point: MapClickPosition['point'];
  lngLat: MapClickPosition['lngLat'];
}

/**
 * A server-side cluster of search results selected on the map.
 */
export interface ClusterMapSelection {
  kind: 'cluster';
  featureCount: number;
  point: MapClickPosition['point'];
  lngLat: MapClickPosition['lngLat'];
}

export type MapSelection = FeatureMapSelection | ClusterMapSelection;

/**
 * Interpret a rendered tile feature as a map selection, using only the decoded MVT properties.
 *
 * The tile contract marks every feature with `render_kind`: `feature` carries `submission_id` and
 * `submission_feature_id`, `cluster` carries `feature_count`. Anything else — an unknown kind, or a feature missing
 * the properties its kind requires — returns null and is ignored, so a malformed tile can never break the page.
 *
 * @param {MapGeoJSONFeature} feature Topmost rendered feature from the map's hit test.
 * @param {MapClickPosition} position Where the click landed.
 * @return {*}  {(MapSelection | null)}
 */
export const resolveMapSelection = (feature: MapGeoJSONFeature, position: MapClickPosition): MapSelection | null => {
  const properties = feature.properties ?? {};

  if (properties.render_kind === 'feature') {
    const submissionId = Number(properties.submission_id);
    const submissionFeatureId = Number(properties.submission_feature_id);

    if (!submissionId || !submissionFeatureId) {
      return null;
    }

    return {
      kind: 'feature',
      submissionId,
      submissionFeatureId,
      point: position.point,
      lngLat: position.lngLat
    };
  }

  if (properties.render_kind === 'cluster') {
    const featureCount = Number(properties.feature_count);

    if (!featureCount || featureCount < 1) {
      return null;
    }

    return {
      kind: 'cluster',
      featureCount,
      point: position.point,
      lngLat: position.lngLat
    };
  }

  return null;
};
