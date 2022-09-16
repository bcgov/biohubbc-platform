import { IMarker, IMarkerLayer } from 'components/map/components/MarkerCluster';
import { IStaticLayer } from 'components/map/components/StaticLayers';
import DatasetPopup from 'components/map/DatasetPopup';
import FeaturePopup, { BoundaryCentroidFeature, BoundaryFeature, OccurrenceFeature } from 'components/map/FeaturePopup';
import { LAYER_NAME, SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { IDatasetVisibility } from 'features/datasets/components/SearchResultList';
import { Feature } from 'geojson';
import { EmptyObject, ISpatialData, ITaxaData } from 'interfaces/useSearchApi.interface';
import { LatLngTuple } from 'leaflet';
import { isObject } from './Utils';

export interface ISpatialDataGroupedBySpecies {
  [species: string]: ISpatialData[];
}

export interface ILayers {
  staticLayer: { [id: string]: IStaticLayer };
  markerLayer: { [id: string]: IMarkerLayer };
}

export const parseSpatialDataByType = (spatialDataRecords: ISpatialData[], datasetVisibility: IDatasetVisibility = {}) => {
  const occurrencesMarkerLayer: IMarkerLayer = { layerName: LAYER_NAME.OCCURRENCES, markers: [], visible: true };
  const boundaryStaticLayer: IStaticLayer = { layerName: LAYER_NAME.BOUNDARIES, features: [], visible: true };

  for (const spatialRecord of spatialDataRecords) {
    if (isEmptyObject(spatialRecord.spatial_data)) {
      continue;
    }

    for (const feature of spatialRecord.spatial_data.features) {
      let visible = true

      if (feature.geometry.type === 'GeometryCollection') {
        // Not expecting or supporting geometry collections
        continue;
      }

      if (isOccurrenceFeature(feature)) {
        // check if species has been toggled on/ off
        const marker = occurrenceMarkerSetup(feature.geometry.coordinates as LatLngTuple, spatialRecord.taxa_data, datasetVisibility);
        if (marker) {
          occurrencesMarkerLayer.markers.push(marker)
        }
      }

      if (isBoundaryFeature(feature)) {
        // check if dataset has been toggled
        const ids = spatialRecord.taxa_data.map(item => item.submission_spatial_component_id);
        const key = ids.join("-")
        if (ids.length > 0) {
          visible = datasetVisibility[key] === undefined
            ? true
            : datasetVisibility[key];
        }

        if (visible) {
          boundaryStaticLayer.features.push({
            geoJSON: feature,
            key: feature.id || feature.properties.id,
            popup: <FeaturePopup submissionSpatialComponentIds={ids} />,
          });
        }
      }

      if (isBoundaryCentroidFeature(feature)) {
        // check if dataset has been toggled
        const ids = spatialRecord.taxa_data.map(item => item.submission_spatial_component_id);
        const key = ids.join("-")
        if (ids.length > 0) {
          visible = datasetVisibility[key] === undefined
            ? true
            : datasetVisibility[key];
        }

        if (visible) {
          boundaryStaticLayer.features.push({
            geoJSON: feature,
            key: feature.id || feature.properties.id,
            popup: <DatasetPopup submissionSpatialComponentIds={ids} />,
          });
        }
      }
    }
  }

  return { markerLayers: [occurrencesMarkerLayer], staticLayers: [boundaryStaticLayer] };
};

const occurrenceMarkerSetup = (latLng: LatLngTuple, taxaData: ITaxaData[], datasetVisibility: IDatasetVisibility): IMarker | null => {
  const submission_ids: number[] = taxaData
    .filter((item: ITaxaData) => {
      if (item.associated_taxa) {
        return datasetVisibility[item.associated_taxa] === undefined
          ? true
          : datasetVisibility[item.associated_taxa]
      }
      return false
    })
    .map((item: ITaxaData) => item.submission_spatial_component_id)

  if (submission_ids.length > 0) {
    return {
      position: latLng,
      key: submission_ids.join("-"),
      popup: <FeaturePopup submissionSpatialComponentIds={submission_ids} />,
      count: submission_ids.length
    }
  }

  return null
}

export const isStaticLayerVisible = (): boolean => {
  return true;
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
