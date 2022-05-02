import { cleanup, render } from '@testing-library/react';
import bbox from '@turf/bbox';
import React from 'react';
import { IMarker } from './components/MarkerCluster';
import { IStaticLayer } from './components/StaticLayers';
import MapContainer from './MapContainer';

describe('MapContainer', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with minimal settings', () => {
    const { container } = render(<MapContainer mapId="myMap" />);

    expect(container.querySelector('#myMap')).toBeInTheDocument();
  });

  it('renders with static geometries', () => {
    const staticLayers: IStaticLayer[] = [
      {
        layerName: 'test layer',
        features: [
          {
            geoJSON: {
              id: 'nonEditableGeo',
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [125.6, 10.1]
              },
              properties: {
                name: 'Biodiversity Land'
              }
            }
          }
        ]
      }
    ];

    const { container } = render(<MapContainer mapId="myMap" staticLayers={staticLayers} />);

    expect(container.querySelector('#myMap')).toBeInTheDocument();
  });

  it('renders with bounds', () => {
    const bboxCoords = bbox({
      id: 'myGeo',
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-128, 55],
            [-128, 55.5],
            [-128, 56],
            [-126, 58],
            [-128, 55]
          ]
        ]
      },
      properties: {
        name: 'Restoration Islands'
      }
    });

    const bounds = [
      [bboxCoords[1], bboxCoords[0]],
      [bboxCoords[3], bboxCoords[2]]
    ];

    const { container } = render(<MapContainer mapId="myMap" bounds={bounds} />);

    expect(container.querySelector('#myMap')).toBeInTheDocument();
  });

  it('renders with scrollWheelZoom', () => {
    const { container } = render(<MapContainer mapId="myMap" scrollWheelZoom={true} />);

    expect(container.querySelector('#myMap')).toBeInTheDocument();
  });

  it('renders with markers', () => {
    const markers: IMarker[] = [
      {
        position: [55, 128]
      }
    ];

    const { container } = render(<MapContainer mapId="myMap" markers={markers} />);

    expect(container.querySelector('#myMap')).toBeInTheDocument();
  });
});
