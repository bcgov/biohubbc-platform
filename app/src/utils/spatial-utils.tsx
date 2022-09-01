import { IMarkerLayer } from 'components/map/components/MarkerCluster';
import { IStaticLayer } from 'components/map/components/StaticLayers';
import DatasetPopup from 'components/map/DatasetPopup';
import FeaturePopup, { BoundaryCentroidFeature, BoundaryFeature, OccurrenceFeature } from 'components/map/FeaturePopup';
import { LAYER_NAME, SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { IDatasetVisibility } from 'features/datasets/components/SearchResultOccurrenceList';
import { Feature } from 'geojson';
import { EmptyObject, ISpatialData } from 'interfaces/useSearchApi.interface';
import { LatLngTuple } from 'leaflet';
import { isObject } from './Utils';

export interface ISpatialDataGroupedBySpecies {
  [species: string]: ISpatialData[];
}

export interface ILayers {
  staticLayer: {[id: string]: IStaticLayer},
  markerLayer: {[id: string]: IMarkerLayer}
}

/**
 * Groups Spatial Data based on type and species taxonomy
 * @param {ISpatialData[]} spatialDataRecords Spatial Data to parse and group
 * @returns {*} {ILayers}
 */
export const groupSpatialDataIntoLayers = (
  spatialDataRecords: ISpatialData[]
) => {

  const layerMap: ILayers = {
    staticLayer: {},
    markerLayer: {}
  };

  for (const spatialRecord of spatialDataRecords) {
    if (isEmptyObject(spatialRecord.spatial_data)) {
      continue;
    }

    for (const feature of spatialRecord.spatial_data.features) {
      if (feature.geometry.type === 'GeometryCollection') {
        // Not expecting or supporting geometry collections
        continue;
      }

      // construct key to use for layers
      const key = getFeatureLayerKey(spatialRecord, feature);

      // is a marker
      if (isOccurrenceFeature(feature)) {
        if (!layerMap.markerLayer[key]) {
          layerMap.markerLayer[key] = {
            visible: true,
            layerName: `${spatialRecord.vernacular_name} (${spatialRecord.associated_taxa})`,
            markers: []
          } as IMarkerLayer
        }

        layerMap.markerLayer[key].markers.push({
          position: feature.geometry.coordinates as LatLngTuple,
          key: feature.id || feature.properties.id,
          popup: <FeaturePopup submissionSpatialComponentId={spatialRecord.submission_spatial_component_id} />
        });
      }

      // is static
      if (isBoundaryFeature(feature)) {
        if (!layerMap.staticLayer[key]) {
          layerMap.staticLayer[key] = {
            visible: true,
            layerName: `${spatialRecord.vernacular_name} (${spatialRecord.associated_taxa})`,
            features: []
          } as IStaticLayer
        }

        layerMap.staticLayer[key].features.push({
          geoJSON: feature,
          key: feature.id || feature.properties.id,
          popup: <FeaturePopup submissionSpatialComponentId={spatialRecord.submission_spatial_component_id} />
        });
      }

      // is static
      if (isBoundaryCentroidFeature(feature)) {
        console.log(spatialRecord)
        if (!layerMap.staticLayer[key]) {
          layerMap.staticLayer[key] = {
            visible: true,
            layerName: `${feature.properties.datasetTitle}`,
            features: []
          } as IStaticLayer
        }

        layerMap.staticLayer[key].features.push({
          geoJSON: feature,
          key: feature.id || feature.properties.id,
          popup: <FeaturePopup submissionSpatialComponentId={spatialRecord.submission_spatial_component_id} />
        });
      }
    }
  }

  return layerMap;
};

export const parseSpatialDataByType = (
  spatialDataRecords: ISpatialData[],
  datasetVisibility: IDatasetVisibility = {}
) => {
  const occurrencesMarkerLayer: IMarkerLayer = { layerName: LAYER_NAME.OCCURRENCES, markers: [], visible: true };
  const boundaryStaticLayer: IStaticLayer = { layerName: LAYER_NAME.BOUNDARIES, features: [], visible: true };

  for (const spatialRecord of spatialDataRecords) {
    if (isEmptyObject(spatialRecord.spatial_data)) {
      continue;
    }

    for (const feature of spatialRecord.spatial_data.features) {
      let visible = true;

      if (feature.geometry.type === 'GeometryCollection') {
        // Not expecting or supporting geometry collections
        continue;
      }

      if (isOccurrenceFeature(feature)) {
        // check if species has been toggled on/ off
        if (spatialRecord.associated_taxa) {
          visible =
            datasetVisibility[spatialRecord.associated_taxa] === undefined
              ? true
              : datasetVisibility[spatialRecord.associated_taxa];
        }

        if (visible) {
          occurrencesMarkerLayer.markers.push({
            position: feature.geometry.coordinates as LatLngTuple,
            key: feature.id || feature.properties.id,
            popup: <FeaturePopup submissionSpatialComponentId={spatialRecord.submission_spatial_component_id} />
          });
        }
      }

      if (isBoundaryFeature(feature)) {
        // check if dataset has been toggled
        if (spatialRecord.submission_spatial_component_id) {
          visible =
            datasetVisibility[spatialRecord.submission_spatial_component_id] === undefined
              ? true
              : datasetVisibility[spatialRecord.submission_spatial_component_id];
        }

        if (visible) {
          boundaryStaticLayer.features.push({
            geoJSON: feature,
            key: feature.id || feature.properties.id,
            popup: <FeaturePopup submissionSpatialComponentId={spatialRecord.submission_spatial_component_id} />
          });
        }
      }

      if (isBoundaryCentroidFeature(feature)) {
        // check if dataset has been toggled
        if (spatialRecord.submission_spatial_component_id) {
          visible =
            datasetVisibility[spatialRecord.submission_spatial_component_id] === undefined
              ? true
              : datasetVisibility[spatialRecord.submission_spatial_component_id];
        }

        if (visible) {
          boundaryStaticLayer.features.push({
            geoJSON: feature,
            key: feature.id || feature.properties.id,
            popup: <DatasetPopup submissionSpatialComponentId={spatialRecord.submission_spatial_component_id} />
          });
        }
      }
    }
  }

  return { markerLayers: [occurrencesMarkerLayer], staticLayers: [boundaryStaticLayer] };
};

// checks which key should be used to identify the layer
export const getFeatureLayerKey = (spatialRecord: ISpatialData, feature: Feature): string => {
  let key = "";

  if (isOccurrenceFeature(feature)) {
    key = `${spatialRecord.associated_taxa}`;
  }

  if (isBoundaryFeature(feature)) {
    key = `${spatialRecord.submission_spatial_component_id}`;
  }

  if (isBoundaryCentroidFeature(feature)) {
    key = `${spatialRecord.submission_spatial_component_id}`;
  }

  return key
}

export const isStaticLayerVisible = (): boolean => {

  return true;
}

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
