import { act, renderHook } from 'test-helpers/test-utils';
import { BC_BASEMAP_LAYER_ID, BC_BASEMAP_SOURCE_ID } from './bc-basemap-layers';
import { clearBcTileClassifications, recordBcTileClassification } from './bc-basemap-registry';
import type { ISlippyMapTile, ISlippyMapViewport } from './SlippyMap.interface';
import { resolveBcBasemapMode, useBcBasemap } from './useBcBasemap';

vi.mock('./bc-basemap-protocol', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./bc-basemap-protocol')>()),
  registerBcBasemapProtocol: vi.fn()
}));

const BASEMAP_URL = 'https://basemap.test/tile/{z}/{y}/{x}';

const VANCOUVER: ISlippyMapTile = { z: 11, x: 323, y: 700, withinBounds: true };
const REGINA: ISlippyMapTile = { z: 11, x: 428, y: 690, withinBounds: true };
const WINNIPEG: ISlippyMapTile = { z: 11, x: 471, y: 695, withinBounds: false };

/** A viewport whose only relevant content is the tiles the BC source needs for it. */
const buildViewport = (tiles: ISlippyMapTile[]): ISlippyMapViewport => ({
  bounds: [-130, 48, -114, 60],
  zoom: 10,
  coveringTiles: (sourceId) => (sourceId === BC_BASEMAP_SOURCE_ID ? tiles : [])
});

describe('useBcBasemap', () => {
  beforeEach(() => {
    clearBcTileClassifications();
  });

  describe('resolveBcBasemapMode', () => {
    const classify = (known: Record<string, 'content' | 'missing'>) => (key: string) => known[key];

    it('keeps the current mode until the viewport has tiles to judge', () => {
      expect(resolveBcBasemapMode([], classify({}), 'fallback')).toBe('fallback');
    });

    it('falls back as soon as a needed tile lies outside the service extent, unasked', () => {
      expect(resolveBcBasemapMode([VANCOUVER, WINNIPEG], classify({ '11/323/700': 'content' }), 'bc')).toBe('fallback');
    });

    it('falls back as soon as a needed tile is known to be missing', () => {
      expect(
        resolveBcBasemapMode([VANCOUVER, REGINA], classify({ '11/323/700': 'content', '11/428/690': 'missing' }), 'bc')
      ).toBe('fallback');
    });

    it('shows BC once every needed tile is known to have content', () => {
      expect(
        resolveBcBasemapMode(
          [VANCOUVER, REGINA],
          classify({ '11/323/700': 'content', '11/428/690': 'content' }),
          'fallback'
        )
      ).toBe('bc');
    });

    it('keeps the current mode while any needed tile is still unknown', () => {
      expect(resolveBcBasemapMode([VANCOUVER, REGINA], classify({ '11/323/700': 'content' }), 'bc')).toBe('bc');
      expect(resolveBcBasemapMode([VANCOUVER, REGINA], classify({ '11/323/700': 'content' }), 'fallback')).toBe(
        'fallback'
      );
    });
  });

  describe('useBcBasemap', () => {
    it('starts on the BC basemap, drawn opaque', () => {
      const { result } = renderHook(() => useBcBasemap(BASEMAP_URL, '© Province of British Columbia'));

      expect(result.current.mode).toBe('bc');
      expect(Object.keys(result.current.tileSources)).toEqual([BC_BASEMAP_SOURCE_ID]);
      expect(result.current.layers.map((layer) => layer.specification)).toEqual([
        expect.objectContaining({ id: BC_BASEMAP_LAYER_ID, paint: { 'raster-opacity': 1 } })
      ]);
    });

    it('offers no basemap without a url', () => {
      const { result } = renderHook(() => useBcBasemap(undefined, undefined));

      expect(result.current.tileSources).toEqual({});
      expect(result.current.layers).toEqual([]);
    });

    it('falls back when the viewport needs a tile the service does not cover', () => {
      const { result } = renderHook(() => useBcBasemap(BASEMAP_URL, ''));

      act(() => {
        result.current.onViewportChange(buildViewport([VANCOUVER, WINNIPEG]));
      });

      expect(result.current.mode).toBe('fallback');
      expect(result.current.layers[0].specification).toMatchObject({ paint: { 'raster-opacity': 0 } });
    });

    it('flips when a tile the viewport needs is classified after the move', () => {
      const { result } = renderHook(() => useBcBasemap(BASEMAP_URL, ''));

      act(() => {
        result.current.onViewportChange(buildViewport([VANCOUVER, REGINA]));
      });
      expect(result.current.mode).toBe('bc');

      act(() => {
        recordBcTileClassification('11/428/690', 'missing');
      });

      expect(result.current.mode).toBe('fallback');
    });

    it('returns to BC once every tile the viewport needs is known to have content', () => {
      recordBcTileClassification('11/428/690', 'missing');
      const { result } = renderHook(() => useBcBasemap(BASEMAP_URL, ''));

      act(() => {
        result.current.onViewportChange(buildViewport([VANCOUVER, REGINA]));
      });
      expect(result.current.mode).toBe('fallback');

      act(() => {
        result.current.onViewportChange(buildViewport([VANCOUVER]));
      });
      expect(result.current.mode).toBe('fallback');

      act(() => {
        recordBcTileClassification('11/323/700', 'content');
      });

      expect(result.current.mode).toBe('bc');
      expect(result.current.layers[0].specification).toMatchObject({ paint: { 'raster-opacity': 1 } });
    });

    it('stops listening for classifications once unmounted', () => {
      const { result, unmount } = renderHook(() => useBcBasemap(BASEMAP_URL, ''));

      act(() => {
        result.current.onViewportChange(buildViewport([REGINA]));
      });
      unmount();

      expect(() => recordBcTileClassification('11/428/690', 'missing')).not.toThrow();
    });
  });
});
