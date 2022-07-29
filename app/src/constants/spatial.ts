import { Feature } from 'geojson';

export const MAP_DEFAULT_ZOOM = 5;
export const MAP_MIN_ZOOM = 3;
export const MAP_MAX_ZOOM = 17;

export const ALL_OF_BC_BOUNDARY: Feature = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-146.95401365536304, 44.62175409623327],
        [-146.95401365536304, 63.528970541102794],
        [-105.07413084286304, 63.528970541102794],
        [-105.07413084286304, 44.62175409623327],
        [-146.95401365536304, 44.62175409623327]
      ]
    ]
  }
};

export enum SPATIAL_COMPONENT_TYPE {
  OCCURRENCE = 'Occurrence',
  BOUNDARY = 'Boundary'
}

export enum LAYER_NAME {
  OCCURRENCES = 'Occurrences',
  BOUNDARIES = 'Boundaries'
}
