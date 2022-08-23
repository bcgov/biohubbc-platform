import { IMarkerLayer } from 'components/map/components/MarkerCluster';
import { IStaticLayer } from 'components/map/components/StaticLayers';
import DatasetPopup from 'components/map/DatasetPopup';
import FeaturePopup, { BoundaryCentroidFeature, BoundaryFeature, OccurrenceFeature } from 'components/map/FeaturePopup';
import { LAYER_NAME, SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { Feature } from 'geojson';
import { EmptyObject, ISpatialData } from 'interfaces/useSearchApi.interface';
import { LatLngTuple } from 'leaflet';
import { isObject } from './Utils';

export const parseSpatialDataByType = (spatialDataRecords: ISpatialData[]) => {
  const occurrencesMarkerLayer: IMarkerLayer = { layerName: LAYER_NAME.OCCURRENCES, markers: [] };
  const occurrenceStaticLayer: IStaticLayer = { layerName: LAYER_NAME.OCCURRENCES, features: [] };
  const boundaryStaticLayer: IStaticLayer = { layerName: LAYER_NAME.BOUNDARIES, features: [] };

  for (const spatialRecord of spatialDataRecords) {
    if (isEmptyObject(spatialRecord.spatial_data)) {
      continue;
    }

    for (const feature of spatialRecord.spatial_data.features) {
      if (feature.geometry.type === 'GeometryCollection') {
        // Not expecting or supporting geometry collections
        continue;
      }

      if (isOccurrenceFeature(feature)) {
        occurrencesMarkerLayer.markers.push({
          position: feature.geometry.coordinates as LatLngTuple,
          key: feature.id || feature.properties.id,
          popup: <FeaturePopup submissionSpatialComponentIds={[spatialRecord.submission_spatial_component_id]} />
        });
      }

      if (isBoundaryFeature(feature)) {
        boundaryStaticLayer.features.push({
          geoJSON: feature,
          key: feature.id || feature.properties.id,
          popup: <FeaturePopup submissionSpatialComponentIds={[spatialRecord.submission_spatial_component_id]} />
        });
      }

      if (isBoundaryCentroidFeature(feature)) {
        boundaryStaticLayer.features.push({
          geoJSON: feature,
          key: feature.id || feature.properties.id,
          popup: <DatasetPopup submissionSpatialComponentIds={[spatialRecord.submission_spatial_component_id]} />
        });
      }
    }
  }

  return { markerLayers: [occurrencesMarkerLayer], staticLayers: [occurrenceStaticLayer, boundaryStaticLayer] };
};

export const isEmptyObject = (obj: any): obj is EmptyObject => {
  // Check if `obj` is an object with no keys (aka: an empty object)
  return !!(isObject(obj) && !Object.keys(obj).length);
};

export const isOccurrenceFeature = (feature: Feature): feature is OccurrenceFeature => {
  return feature.geometry.type === 'Point' && feature.properties?.['type'] === SPATIAL_COMPONENT_TYPE.OCCURRENCE;
};

export const isBoundaryFeature = (feature: Feature): feature is BoundaryFeature => {
  return feature?.properties?.['type'] === SPATIAL_COMPONENT_TYPE.BOUNDARY;
};

export const isBoundaryCentroidFeature = (feature: Feature): feature is BoundaryCentroidFeature => {
  return feature?.properties?.['type'] === SPATIAL_COMPONENT_TYPE.BOUNDARY_CENTROID;
};
