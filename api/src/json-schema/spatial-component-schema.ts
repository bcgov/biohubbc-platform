import {
  GeoJSONGeometryCollection,
  GeoJSONLineString,
  GeoJSONMultiLineString,
  GeoJSONMultiPoint,
  GeoJSONMultiPolygon,
  GeoJSONPoint,
  GeoJSONPolygon
} from '../openapi/schemas/geoJson';

export const SpatialComponent_BoundaryProperties = {
  $id: 'SpatialComponent_BoundaryProperties',
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['Boundary']
    },
    dwc: {
      type: 'object'
    }
  }
};

export const SpatialComponent_OccurrenceProperties = {
  $id: 'SpatialComponent_OccurrenceProperties',
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['Occurrence']
    },
    dwc: {
      type: 'object'
    }
  }
};

export const SpatialComponent_GeoJSONFeature = {
  $id: 'SpatialComponent_GeoJSONFeature',
  title: 'GeoJSON Feature',
  type: 'object',
  required: ['type', 'properties', 'geometry'],
  properties: {
    type: {
      type: 'string',
      enum: ['Feature']
    },
    id: {
      oneOf: [
        {
          type: 'number'
        },
        {
          type: 'string'
        }
      ]
    },
    properties: {
      oneOf: [SpatialComponent_BoundaryProperties, SpatialComponent_OccurrenceProperties]
    },
    geometry: {
      oneOf: [
        GeoJSONPoint,
        GeoJSONLineString,
        GeoJSONPolygon,
        GeoJSONMultiPoint,
        GeoJSONMultiLineString,
        GeoJSONMultiPolygon,
        GeoJSONGeometryCollection
      ],
      nullable: true
    },
    bbox: {
      type: 'array',
      minItems: 4,
      items: {
        type: 'number'
      }
    }
  }
};

export const SpatialComponent_GeoJSONFeatureCollection = {
  $id: 'SpatialComponent_GeoJSONFeatureCollection',
  title: 'GeoJSON FeatureCollection',
  type: 'object',
  required: ['type', 'features'],
  properties: {
    type: {
      type: 'string',
      enum: ['FeatureCollection']
    },
    features: {
      type: 'array',
      items: {
        anyOf: [SpatialComponent_GeoJSONFeature]
      }
    },
    bbox: {
      type: 'array',
      minItems: 4,
      items: {
        type: 'number'
      }
    }
  }
};
