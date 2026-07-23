import type { Feature, Polygon } from 'geojson';
import type { GeoJSONStoreFeatures } from 'terra-draw';
import { act, cleanup, fireEvent, render } from 'test-helpers/test-utils';
import { SlippyMap } from './SlippyMap';
import type { ISlippyMapProps } from './SlippyMap.interface';
import { SLIPPY_MAP_DEFAULT_STYLE } from './SlippyMap.utils';

const mocks = vi.hoisted(() => {
  class MockMaplibreMap {
    static instances: MockMaplibreMap[] = [];

    options: Record<string, unknown>;
    handlers: Record<string, ((...args: unknown[]) => void)[]> = {};

    resize = vi.fn();
    remove = vi.fn();

    constructor(options: Record<string, unknown>) {
      this.options = options;
      MockMaplibreMap.instances.push(this);
    }

    once = vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      (this.handlers[event] ??= []).push(callback);
    });

    on = vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      (this.handlers[event] ??= []).push(callback);
    });

    fire(event: string) {
      for (const callback of [...(this.handlers[event] ?? [])]) {
        callback();
      }
    }
  }

  class MockTerraDraw {
    static instances: MockTerraDraw[] = [];

    config: { adapter: unknown; modes: { mode?: string }[] };
    handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
    snapshot: unknown[] = [];

    start = vi.fn();
    stop = vi.fn();
    setMode = vi.fn();
    clear = vi.fn();
    removeFeatures = vi.fn();
    deselectFeature = vi.fn();
    addFeatures = vi.fn((features: { id?: unknown }[]) => features.map((feature) => ({ id: feature.id, valid: true })));
    getSnapshot = vi.fn(() => this.snapshot);
    off = vi.fn();

    constructor(config: { adapter: unknown; modes: { mode?: string }[] }) {
      this.config = config;
      MockTerraDraw.instances.push(this);
    }

    on = vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      (this.handlers[event] ??= []).push(callback);
    });

    emit(event: string, ...args: unknown[]) {
      for (const callback of this.handlers[event] ?? []) {
        callback(...args);
      }
    }
  }

  class MockTerraDrawAdapter {
    static instances: MockTerraDrawAdapter[] = [];

    config: { map: unknown };

    constructor(config: { map: unknown }) {
      this.config = config;
      MockTerraDrawAdapter.instances.push(this);
    }
  }

  class MockPointMode {
    mode = 'point';
  }
  class MockLineStringMode {
    mode = 'linestring';
  }
  class MockPolygonMode {
    mode = 'polygon';
  }
  class MockSelectMode {
    mode = 'select';
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
    }
  }

  return {
    MockMaplibreMap,
    MockTerraDraw,
    MockTerraDrawAdapter,
    MockPointMode,
    MockLineStringMode,
    MockPolygonMode,
    MockSelectMode
  };
});

vi.mock('maplibre-gl', () => ({ Map: mocks.MockMaplibreMap }));

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

vi.mock('terra-draw', () => ({
  TerraDraw: mocks.MockTerraDraw,
  TerraDrawPointMode: mocks.MockPointMode,
  TerraDrawLineStringMode: mocks.MockLineStringMode,
  TerraDrawPolygonMode: mocks.MockPolygonMode,
  TerraDrawSelectMode: mocks.MockSelectMode
}));

vi.mock('terra-draw-maplibre-gl-adapter', () => ({ TerraDrawMapLibreGLAdapter: mocks.MockTerraDrawAdapter }));

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  callback: ResizeObserverCallback;

  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

const VALID_UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VALID_UUID_B = 'bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb';

const POLYGON_GEOMETRY: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0]
    ]
  ]
};

const getExternalPolygon = (id: string, name = 'external polygon'): Feature => {
  return { type: 'Feature', id, geometry: POLYGON_GEOMETRY, properties: { name } };
};

const getStorePolygon = (id: string, properties: Record<string, unknown> = {}): GeoJSONStoreFeatures => {
  return {
    type: 'Feature',
    id,
    geometry: POLYGON_GEOMETRY,
    properties: { mode: 'polygon', ...properties }
  } as GeoJSONStoreFeatures;
};

const getHelperPoint = (properties: Record<string, unknown>): GeoJSONStoreFeatures => {
  return {
    type: 'Feature',
    id: VALID_UUID_B,
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { mode: 'select', ...properties }
  } as GeoJSONStoreFeatures;
};

const renderSlippyMap = (props: Partial<ISlippyMapProps> = {}) => {
  const result = render(<SlippyMap {...props} />);
  return { ...result, map: mocks.MockMaplibreMap.instances[0] };
};

const loadMap = (map: InstanceType<typeof mocks.MockMaplibreMap>) => {
  act(() => {
    map.fire('load');
  });
  return mocks.MockTerraDraw.instances[0];
};

describe('SlippyMap', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.MockMaplibreMap.instances.length = 0;
    mocks.MockTerraDraw.instances.length = 0;
    mocks.MockTerraDrawAdapter.instances.length = 0;
    MockResizeObserver.instances.length = 0;
  });

  describe('map initialization', () => {
    it('initializes the map once with the provided display options', () => {
      const { map, getByTestId } = renderSlippyMap({ initialCenter: [-125, 52.5], initialZoom: 5 });

      expect(mocks.MockMaplibreMap.instances).toHaveLength(1);
      expect(map.options).toEqual(
        expect.objectContaining({
          container: getByTestId('slippy-map-container'),
          style: SLIPPY_MAP_DEFAULT_STYLE,
          center: [-125, 52.5],
          zoom: 5,
          trackResize: false
        })
      );
    });

    it('initializes the map with the provided style and additional map options', () => {
      const { map } = renderSlippyMap({ mapStyle: 'https://example.com/style.json', mapOptions: { maxZoom: 15 } });

      expect(map.options).toEqual(expect.objectContaining({ style: 'https://example.com/style.json', maxZoom: 15 }));
    });

    it('initializes the drawing library only once the map has loaded', () => {
      const { map } = renderSlippyMap({ drawControls: { polygon: true } });

      expect(mocks.MockTerraDraw.instances).toHaveLength(0);

      const draw = loadMap(map);

      expect(mocks.MockTerraDrawAdapter.instances[0].config).toEqual(expect.objectContaining({ map }));
      expect(draw.config.modes.map((mode) => mode.mode)).toEqual(['point', 'linestring', 'polygon', 'select']);
      expect(draw.start).toHaveBeenCalledTimes(1);
      expect(draw.setMode).toHaveBeenCalledWith('select');
    });

    it('starts in the static (non-interactive) mode when no draw controls are provided', () => {
      const { map } = renderSlippyMap();

      const draw = loadMap(map);

      expect(draw.setMode).toHaveBeenCalledWith('static');
    });
  });

  describe('draw callbacks', () => {
    it('fires onDrawCreate with only the newly created feature when drawing completes', () => {
      const onDrawCreate = vi.fn();
      const onDrawUpdate = vi.fn();

      const { map } = renderSlippyMap({ drawControls: { polygon: true }, onDrawCreate, onDrawUpdate });
      const draw = loadMap(map);

      draw.snapshot = [
        getStorePolygon(VALID_UUID_B, { name: 'existing polygon' }),
        getStorePolygon(VALID_UUID_A, { name: 'drawn polygon' })
      ];

      act(() => {
        draw.emit('finish', VALID_UUID_A, { mode: 'polygon', action: 'draw' });
      });

      expect(onDrawCreate).toHaveBeenCalledTimes(1);
      expect(onDrawCreate).toHaveBeenCalledWith([
        { type: 'Feature', id: VALID_UUID_A, geometry: POLYGON_GEOMETRY, properties: { name: 'drawn polygon' } }
      ]);
      expect(onDrawUpdate).not.toHaveBeenCalled();
    });

    it('fires onDrawUpdate with the full cleaned feature set when an edit completes', () => {
      const onDrawUpdate = vi.fn();

      const { map } = renderSlippyMap({ drawControls: { polygon: true }, onDrawUpdate });
      const draw = loadMap(map);

      draw.snapshot = [
        getStorePolygon(VALID_UUID_A, { name: 'polygon a' }),
        getStorePolygon(VALID_UUID_B, { name: 'polygon b' }),
        getHelperPoint({ selectionPoint: true }),
        getHelperPoint({ midPoint: true })
      ];

      act(() => {
        draw.emit('finish', VALID_UUID_A, { mode: 'select', action: 'dragCoordinate' });
      });

      expect(onDrawUpdate).toHaveBeenCalledTimes(1);
      expect(onDrawUpdate).toHaveBeenCalledWith([
        { type: 'Feature', id: VALID_UUID_A, geometry: POLYGON_GEOMETRY, properties: { name: 'polygon a' } },
        { type: 'Feature', id: VALID_UUID_B, geometry: POLYGON_GEOMETRY, properties: { name: 'polygon b' } }
      ]);
    });

    it('fires onDrawDelete with the remaining features when the user deletes a feature via the keyboard', () => {
      const onDrawDelete = vi.fn();

      const { map } = renderSlippyMap({ drawControls: { polygon: true }, onDrawDelete });
      const draw = loadMap(map);

      // Make both features known real features
      draw.snapshot = [
        getStorePolygon(VALID_UUID_A, { name: 'deleted polygon' }),
        getStorePolygon(VALID_UUID_B, { name: 'remaining polygon' })
      ];
      act(() => {
        draw.emit('change', [VALID_UUID_A, VALID_UUID_B], 'create', undefined);
      });

      draw.snapshot = [getStorePolygon(VALID_UUID_B, { name: 'remaining polygon' })];

      act(() => {
        draw.emit('change', [VALID_UUID_A], 'delete', undefined);
      });

      expect(onDrawDelete).toHaveBeenCalledTimes(1);
      expect(onDrawDelete).toHaveBeenCalledWith([
        { type: 'Feature', id: VALID_UUID_B, geometry: POLYGON_GEOMETRY, properties: { name: 'remaining polygon' } }
      ]);
    });

    it('fires onDrawDelete when a user deletes an externally-loaded feature via the keyboard', () => {
      const onDrawDelete = vi.fn();

      const { map } = renderSlippyMap({
        features: [getExternalPolygon(VALID_UUID_A)],
        drawControls: { polygon: true },
        onDrawDelete
      });
      const draw = loadMap(map);

      // Mirror terra-draw: addFeatures during the initial sync emits an api-origin 'create' change, which is what
      // registers the loaded feature as a real feature for later delete-detection.
      draw.snapshot = [getStorePolygon(VALID_UUID_A, { name: 'external polygon' })];
      act(() => {
        draw.emit('change', [VALID_UUID_A], 'create', { origin: 'api' });
      });

      // The user selects and deletes the loaded feature with the keyboard.
      draw.snapshot = [];
      act(() => {
        draw.emit('change', [VALID_UUID_A], 'delete', undefined);
      });

      expect(onDrawDelete).toHaveBeenCalledTimes(1);
      expect(onDrawDelete).toHaveBeenCalledWith([]);
    });

    it('ignores deletions of the drawing library internal helper features', () => {
      const onDrawDelete = vi.fn();

      const { map } = renderSlippyMap({ drawControls: { polygon: true }, onDrawDelete });
      const draw = loadMap(map);

      // A real feature exists on the map
      draw.snapshot = [getStorePolygon(VALID_UUID_A, { name: 'real polygon' })];
      act(() => {
        draw.emit('change', [VALID_UUID_A], 'create', undefined);
      });

      // The drawing library deletes its own helper features (eg: polygon closing points) with identical events
      act(() => {
        draw.emit('change', ['helper-id-1', 'helper-id-2'], 'delete', undefined);
      });

      expect(onDrawDelete).not.toHaveBeenCalled();
    });

    it('ignores delete change events raised by programmatic (api) store changes', () => {
      const onDrawDelete = vi.fn();

      const { map } = renderSlippyMap({ drawControls: { polygon: true }, onDrawDelete });
      const draw = loadMap(map);

      draw.snapshot = [getStorePolygon(VALID_UUID_A)];
      act(() => {
        draw.emit('change', [VALID_UUID_A], 'create', undefined);
      });

      draw.snapshot = [];

      act(() => {
        draw.emit('change', [VALID_UUID_A], 'delete', { origin: 'api' });
      });

      expect(onDrawDelete).not.toHaveBeenCalled();
    });

    it('deletes the selected feature via the trash control and fires onDrawDelete with the remaining features', () => {
      const onDrawDelete = vi.fn();

      const { map, getByTestId } = renderSlippyMap({ drawControls: { polygon: true, trash: true }, onDrawDelete });
      const draw = loadMap(map);

      expect(getByTestId('slippy-map-draw-trash')).toBeDisabled();

      act(() => {
        draw.emit('select', VALID_UUID_A);
      });

      expect(getByTestId('slippy-map-draw-trash')).toBeEnabled();

      draw.snapshot = [getStorePolygon(VALID_UUID_B, { name: 'remaining polygon' })];

      fireEvent.click(getByTestId('slippy-map-draw-trash'));

      expect(draw.deselectFeature).toHaveBeenCalledWith(VALID_UUID_A);
      expect(draw.removeFeatures).toHaveBeenCalledWith([VALID_UUID_A]);
      expect(onDrawDelete).toHaveBeenCalledWith([
        { type: 'Feature', id: VALID_UUID_B, geometry: POLYGON_GEOMETRY, properties: { name: 'remaining polygon' } }
      ]);
      expect(getByTestId('slippy-map-draw-trash')).toBeDisabled();
    });

    it('activates draw modes from the toolbar and returns to select mode on re-click', () => {
      const { map, getByTestId } = renderSlippyMap({ drawControls: { polygon: true } });
      const draw = loadMap(map);

      fireEvent.click(getByTestId('slippy-map-draw-mode-polygon'));

      expect(draw.setMode).toHaveBeenCalledWith('polygon');
      expect(getByTestId('slippy-map-draw-mode-polygon')).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(getByTestId('slippy-map-draw-mode-polygon'));

      expect(draw.setMode).toHaveBeenLastCalledWith('select');
      expect(getByTestId('slippy-map-draw-mode-polygon')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('external features', () => {
    it('displays the provided features once the map loads', () => {
      const { map } = renderSlippyMap({ features: [getExternalPolygon(VALID_UUID_A)] });
      const draw = loadMap(map);

      expect(draw.clear).toHaveBeenCalledTimes(1);
      expect(draw.addFeatures).toHaveBeenCalledTimes(1);
      expect(draw.addFeatures).toHaveBeenCalledWith([
        expect.objectContaining({
          id: VALID_UUID_A,
          properties: expect.objectContaining({ mode: 'polygon', name: 'external polygon' })
        })
      ]);
    });

    it('updates the displayed features without recreating the map when the features prop changes', () => {
      const { map, rerender } = renderSlippyMap({ features: [getExternalPolygon(VALID_UUID_A)] });
      const draw = loadMap(map);

      rerender(<SlippyMap features={[getExternalPolygon(VALID_UUID_A), getExternalPolygon(VALID_UUID_B, 'second')]} />);

      expect(draw.addFeatures).toHaveBeenCalledTimes(2);
      expect(draw.addFeatures).toHaveBeenLastCalledWith([
        expect.objectContaining({ id: VALID_UUID_A }),
        expect.objectContaining({ id: VALID_UUID_B })
      ]);
      expect(mocks.MockMaplibreMap.instances).toHaveLength(1);
    });

    it('skips re-syncing when the provided features match the features already displayed', () => {
      const { map, rerender } = renderSlippyMap({ features: [] });
      const draw = loadMap(map);

      // Simulate a feature the user drew, which the consumer persisted and passed back in
      draw.snapshot = [getStorePolygon(VALID_UUID_A, { name: 'drawn polygon' })];

      rerender(
        <SlippyMap
          features={[
            { type: 'Feature', id: VALID_UUID_A, geometry: POLYGON_GEOMETRY, properties: { name: 'drawn polygon' } }
          ]}
        />
      );

      expect(draw.clear).not.toHaveBeenCalled();
      expect(draw.addFeatures).not.toHaveBeenCalled();
    });
  });

  describe('read only', () => {
    it('hides the toolbar and uses the static mode when readOnly is true', () => {
      const { map, queryByTestId } = renderSlippyMap({ drawControls: { polygon: true, trash: true }, readOnly: true });
      const draw = loadMap(map);

      expect(queryByTestId('slippy-map-draw-toolbar')).not.toBeInTheDocument();
      expect(draw.setMode).toHaveBeenCalledWith('static');
      expect(draw.setMode).not.toHaveBeenCalledWith('select');
    });

    it('re-enables editing when readOnly changes to false', () => {
      const { map, queryByTestId, rerender } = renderSlippyMap({
        drawControls: { polygon: true, trash: true },
        readOnly: true
      });
      const draw = loadMap(map);

      rerender(<SlippyMap drawControls={{ polygon: true, trash: true }} readOnly={false} />);

      expect(draw.setMode).toHaveBeenLastCalledWith('select');
      expect(queryByTestId('slippy-map-draw-toolbar')).toBeInTheDocument();
    });
  });

  describe('container resizing', () => {
    it('resizes the map when the container size changes, without recreating the map', () => {
      const { map, getByTestId } = renderSlippyMap();

      const resizeObserver = MockResizeObserver.instances[0];

      expect(resizeObserver.observe).toHaveBeenCalledWith(getByTestId('slippy-map-container'));

      act(() => {
        resizeObserver.trigger();
      });

      expect(map.resize).toHaveBeenCalledTimes(1);
      expect(mocks.MockMaplibreMap.instances).toHaveLength(1);
    });
  });

  describe('cleanup', () => {
    it('cleans up the drawing library, observers, event listeners, and map on unmount', () => {
      const { map, unmount } = renderSlippyMap({ drawControls: { polygon: true } });
      const draw = loadMap(map);

      const resizeObserver = MockResizeObserver.instances[0];

      unmount();

      expect(resizeObserver.disconnect).toHaveBeenCalledTimes(1);
      expect(draw.off).toHaveBeenCalledTimes(4);
      expect(draw.off.mock.calls.map((call) => call[0])).toEqual(
        expect.arrayContaining(['finish', 'change', 'select', 'deselect'])
      );
      expect(draw.stop).toHaveBeenCalledTimes(1);
      expect(map.remove).toHaveBeenCalledTimes(1);
      // The drawing library must release the map's resources before the map itself is removed
      expect(draw.stop.mock.invocationCallOrder[0]).toBeLessThan(map.remove.mock.invocationCallOrder[0]);
    });

    it('cleans up without errors when unmounted before the map has loaded', () => {
      const { map, unmount } = renderSlippyMap();

      unmount();

      expect(mocks.MockTerraDraw.instances).toHaveLength(0);
      expect(map.remove).toHaveBeenCalledTimes(1);
    });
  });
});
