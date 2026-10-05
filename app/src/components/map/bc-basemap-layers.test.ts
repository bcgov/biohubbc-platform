import {
  BC_BASEMAP_COVERAGE_BBOX,
  BC_BASEMAP_MAX_ZOOM,
  BC_BASEMAP_MIN_ZOOM,
  BC_BASEMAP_TILE_SIZE
} from 'constants/basemap';
import {
  BC_BASEMAP_LAYER_ID,
  BC_BASEMAP_SOURCE_ID,
  buildBcBasemapLayer,
  buildBcBasemapSource
} from './bc-basemap-layers';
import { BC_BASEMAP_PROTOCOL } from './bc-basemap-protocol';

const mocks = vi.hoisted(() => ({
  registerBcBasemapProtocol: vi.fn()
}));

vi.mock('./bc-basemap-protocol', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./bc-basemap-protocol')>()),
  registerBcBasemapProtocol: mocks.registerBcBasemapProtocol
}));

const BASEMAP_URL = 'https://basemap.test/tile/{z}/{y}/{x}';

describe('bc-basemap-layers', () => {
  describe('buildBcBasemapSource', () => {
    it("declares the service's extent and zoom range and routes its tiles through the protocol", () => {
      const source = buildBcBasemapSource(BASEMAP_URL, '© Province of British Columbia');

      expect(source).toEqual({
        type: 'raster',
        tiles: [`${BC_BASEMAP_PROTOCOL}://{z}/{x}/{y}?template=${encodeURIComponent(BASEMAP_URL)}`],
        tileSize: BC_BASEMAP_TILE_SIZE,
        minzoom: BC_BASEMAP_MIN_ZOOM,
        maxzoom: BC_BASEMAP_MAX_ZOOM,
        bounds: BC_BASEMAP_COVERAGE_BBOX,
        attribution: '© Province of British Columbia'
      });
    });

    it('registers the protocol handler, so its template never reaches a map unhandled', () => {
      buildBcBasemapSource(BASEMAP_URL, '');

      expect(mocks.registerBcBasemapProtocol).toHaveBeenCalled();
    });
  });

  describe('buildBcBasemapLayer', () => {
    it('draws the source opaque in BC mode', () => {
      expect(buildBcBasemapLayer('bc')).toEqual({
        specification: {
          id: BC_BASEMAP_LAYER_ID,
          type: 'raster',
          source: BC_BASEMAP_SOURCE_ID,
          paint: { 'raster-opacity': 1 }
        }
      });
    });

    it('keeps the layer but paints nothing in fallback mode, so its tiles keep loading', () => {
      expect(buildBcBasemapLayer('fallback').specification).toMatchObject({ paint: { 'raster-opacity': 0 } });
    });
  });
});
