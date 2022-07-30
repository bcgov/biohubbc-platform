import { LAYER_NAME, SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { ISpatialData } from 'interfaces/useSearchApi.interface';
import { parseFeatureCollectionsByType } from './spatial-utils';

describe('parseFeatureCollectionsByType', () => {
  it('returns empty responses if featureCollections param is empty', () => {
    const spatialData: ISpatialData[] = [];

    const result = parseFeatureCollectionsByType(spatialData);

    expect(result.markerLayers).toEqual([{ layerName: LAYER_NAME.OCCURRENCES, markers: [] }]);

    expect(result.staticLayers).toEqual([
      { layerName: LAYER_NAME.OCCURRENCES, features: [] },
      { layerName: LAYER_NAME.BOUNDARIES, features: [] }
    ]);
  });

  it('returns empty responses if featureCollections param is has no features', () => {
    const spatialData: ISpatialData[] = [
      {
        featureCollection:  {
          type: 'FeatureCollection',
          features: []
        },
        submissionSpatialComponentId: 1
      }
    ];

    const result = parseFeatureCollectionsByType(spatialData);

    expect(result.markerLayers).toEqual([{ layerName: LAYER_NAME.OCCURRENCES, markers: [] }]);

    expect(result.staticLayers).toEqual([
      { layerName: LAYER_NAME.OCCURRENCES, features: [] },
      { layerName: LAYER_NAME.BOUNDARIES, features: [] }
    ]);
  });

  it('returns non-empty responses if featureCollections has features', () => {
    const featureCollections: ISpatialData[] = [
      {
        featureCollection: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [123, 456]
              },
              properties: {
                type: SPATIAL_COMPONENT_TYPE.OCCURRENCE
              }
            }
          ]
        },
        submissionSpatialComponentId: 1
      },
      {
        featureCollection: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'GeometryCollection',
                geometries: []
              },
              properties: {}
            }
          ]
        },
        submissionSpatialComponentId: 2
      },
      {
        featureCollection: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [321, 654]
              },
              properties: {
                type: SPATIAL_COMPONENT_TYPE.BOUNDARY
              }
            }
          ]
        },
        submissionSpatialComponentId: 3
      }
    ];

    const result = parseFeatureCollectionsByType(featureCollections);

    expect(result.markerLayers.length).toEqual(1);
    expect(result.markerLayers[0]).toMatchObject({
      layerName: LAYER_NAME.OCCURRENCES,
      markers: [
        {
          position: [123, 456],
          key: undefined,
          popup: expect.any(Object)
        }
      ]
    });

    expect(result.staticLayers.length).toEqual(2);
    expect(result.staticLayers[0]).toEqual({ layerName: LAYER_NAME.OCCURRENCES, features: [] });
    expect(result.staticLayers[1]).toMatchObject({
      layerName: LAYER_NAME.BOUNDARIES,
      features: [
        {
          geoJSON: {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [321, 654]
            },
            properties: {
              type: SPATIAL_COMPONENT_TYPE.BOUNDARY
            }
          },
          key: undefined,
          popup: expect.any(Object)
        }
      ]
    });
  });
});
