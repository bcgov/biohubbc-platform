import Box from '@mui/material/Box';
import type { Feature } from 'geojson';
import { useDeepCompareEffect } from 'hooks/useDeepCompareEffect';
import { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { SlippyMapDrawToolbar } from './components/SlippyMapDrawToolbar';
import type { ISlippyMapProps, SlippyMapDrawMode } from './SlippyMap.interface';
import {
  areFeatureSetsEqual,
  extractSnapshotFeatures,
  hasEnabledDrawControl,
  isDrawModeEnabled,
  isSupportedDrawFeature,
  normalizeFeaturesForDraw,
  SLIPPY_MAP_DEFAULT_STYLE
} from './SlippyMap.utils';

/**
 * Select mode flags enabling feature editing per draw mode: features can be dragged, and line/polygon vertices can
 * be dragged, inserted (via midpoints), and deleted.
 */
const SELECT_MODE_FLAGS = {
  point: { feature: { draggable: true } },
  linestring: { feature: { draggable: true, coordinates: { draggable: true, midpoints: true, deletable: true } } },
  polygon: { feature: { draggable: true, coordinates: { draggable: true, midpoints: true, deletable: true } } }
};

/**
 * A reusable interactive map component (MapLibre) that displays GeoJSON features and exposes drawing events through
 * callbacks.
 *
 * The component holds no business state: consumers own the features (pass them via `features`, persist the features
 * emitted by the `onDraw*` callbacks) and all display options. Map and drawing library internals stay inside the
 * component.
 *
 * @example
 * <SlippyMap
 *   sx={{ height: 500 }}
 *   initialCenter={[-125, 52.5]}
 *   initialZoom={5}
 *   features={features}
 *   drawControls={{ polygon: true, trash: true }}
 *   onDrawCreate={(createdFeatures) => setFeatures((current) => [...current, ...createdFeatures])}
 *   onDrawUpdate={(updatedFeatures) => setFeatures(updatedFeatures)}
 *   onDrawDelete={(remainingFeatures) => setFeatures(remainingFeatures)}
 * />
 *
 * @param {ISlippyMapProps} props
 * @return {JSX.Element}
 */
export const SlippyMap = (props: ISlippyMapProps) => {
  const { id, features, drawControls, readOnly, onDrawCreate, onDrawUpdate, onDrawDelete, sx } = props;

  const isEditable = hasEnabledDrawControl(drawControls) && !readOnly;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  // Suppresses drawing event handlers while the component itself is mutating the drawing library's store
  const isSyncingRef = useRef(false);
  // Ids of the real (consumer-facing) features currently on the map. Used to tell deletions of real features apart
  // from deletions of the drawing library's internal helper features, which arrive as identical store events.
  const realFeatureIdsRef = useRef<Set<string | number>>(new Set());
  const selectedFeatureIdRef = useRef<string | number | null>(null);
  // Latest props, so drawing event handlers (bound once on map load) never read stale values
  const callbacksRef = useRef({ onDrawCreate, onDrawUpdate, onDrawDelete });
  const featuresRef = useRef<Feature[]>(features ?? []);
  const isEditableRef = useRef(isEditable);
  // Display options are applied on mount only
  const initialViewRef = useRef({
    initialCenter: props.initialCenter,
    initialZoom: props.initialZoom,
    mapStyle: props.mapStyle,
    mapOptions: props.mapOptions
  });

  const [activeDrawMode, setActiveDrawMode] = useState<SlippyMapDrawMode | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | number | null>(null);

  useEffect(() => {
    callbacksRef.current = { onDrawCreate, onDrawUpdate, onDrawDelete };
    featuresRef.current = features ?? [];
    isEditableRef.current = isEditable;
  });

  /**
   * Replaces the features displayed on the map with the provided features, skipping the update when the provided
   * features already match what is displayed (ie: the consumer passed back the features that the map emitted).
   */
  const syncFeaturesIntoDraw = useCallback((incomingFeatures: Feature[]) => {
    const draw = drawRef.current;

    if (!draw) {
      // The map has not loaded yet; the load handler performs the initial sync
      return;
    }

    const currentFeatures = extractSnapshotFeatures(draw.getSnapshot());

    if (areFeatureSetsEqual(incomingFeatures.filter(isSupportedDrawFeature), currentFeatures)) {
      return;
    }

    const { normalized, skipped } = normalizeFeaturesForDraw(incomingFeatures);

    if (skipped.length) {
      console.warn(
        'SlippyMap: skipped features with unsupported geometry types',
        skipped.map((feature) => feature.geometry.type)
      );
    }

    isSyncingRef.current = true;
    try {
      if (selectedFeatureIdRef.current !== null) {
        draw.deselectFeature(selectedFeatureIdRef.current);
      }

      draw.clear();

      if (normalized.length) {
        const invalidResults = draw.addFeatures(normalized).filter((result) => !result.valid);

        if (invalidResults.length) {
          console.warn('SlippyMap: some features failed drawing library validation', invalidResults);
        }
      }
    } finally {
      isSyncingRef.current = false;
    }

    selectedFeatureIdRef.current = null;
    setSelectedFeatureId(null);
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const { initialCenter, initialZoom, mapStyle, mapOptions } = initialViewRef.current;

    const map = new MapLibreMap({
      ...mapOptions,
      container,
      style: mapStyle ?? SLIPPY_MAP_DEFAULT_STYLE,
      center: initialCenter ?? [0, 0],
      zoom: initialZoom ?? 0,
      // Resizing is handled by the ResizeObserver below; keep this last so `mapOptions` cannot re-enable it
      trackResize: false
    });
    mapRef.current = map;

    /**
     * Emits the create/update callbacks when a drawing or editing action completes.
     */
    const handleDrawFinish = (featureId: string | number, context: { mode: string; action: string }) => {
      const draw = drawRef.current;

      if (!draw || isSyncingRef.current) {
        return;
      }

      const currentFeatures = extractSnapshotFeatures(draw.getSnapshot());
      realFeatureIdsRef.current = new Set(currentFeatures.map((feature) => feature.id as string | number));

      if (context.action === 'draw') {
        const createdFeature = currentFeatures.find((feature) => feature.id === featureId);

        if (createdFeature) {
          callbacksRef.current.onDrawCreate?.([createdFeature]);
        }

        return;
      }

      callbacksRef.current.onDrawUpdate?.(currentFeatures);
    };

    /**
     * Emits the delete callback for user-driven deletions of real features (eg: keyboard `Delete`), which fire no
     * `finish` event. The drawing library also creates/deletes internal helper features (selection points, closing
     * points, etc) through identical store events, so deletions only count when a tracked real feature id was
     * removed. Programmatic store changes made by this component are ignored.
     */
    const handleDrawChange = (
      featureIds: (string | number)[],
      type: string,
      context?: { origin?: string; target?: string }
    ) => {
      if (type !== 'create' && type !== 'delete') {
        return;
      }

      const draw = drawRef.current;

      if (!draw) {
        return;
      }

      const wasRealFeatureDeleted =
        type === 'delete' && featureIds.some((featureId) => realFeatureIdsRef.current.has(featureId));

      const currentFeatures = extractSnapshotFeatures(draw.getSnapshot());
      realFeatureIdsRef.current = new Set(currentFeatures.map((feature) => feature.id as string | number));

      if (!wasRealFeatureDeleted || isSyncingRef.current || context?.origin === 'api') {
        return;
      }

      selectedFeatureIdRef.current = null;
      setSelectedFeatureId(null);

      callbacksRef.current.onDrawDelete?.(currentFeatures);
    };

    /**
     * Tracks the currently selected feature (enables the trash control).
     */
    const handleFeatureSelect = (featureId: string | number) => {
      selectedFeatureIdRef.current = featureId;
      setSelectedFeatureId(featureId);
    };

    /**
     * Clears the selected feature.
     */
    const handleFeatureDeselect = () => {
      selectedFeatureIdRef.current = null;
      setSelectedFeatureId(null);
    };

    /**
     * Initializes the drawing library once the map style has loaded (the drawing library adds sources/layers to the
     * map and requires a loaded style).
     */
    const handleMapLoad = () => {
      const adapter = new TerraDrawMapLibreGLAdapter({ map });

      const draw = new TerraDraw({
        adapter,
        modes: [
          new TerraDrawPointMode(),
          new TerraDrawLineStringMode(),
          new TerraDrawPolygonMode(),
          new TerraDrawSelectMode({ flags: SELECT_MODE_FLAGS })
        ]
      });
      drawRef.current = draw;

      draw.start();
      draw.on('finish', handleDrawFinish);
      draw.on('change', handleDrawChange);
      draw.on('select', handleFeatureSelect);
      draw.on('deselect', handleFeatureDeselect);
      // The built-in `static` mode ignores all map interactions
      draw.setMode(isEditableRef.current ? 'select' : 'static');

      syncFeaturesIntoDraw(featuresRef.current);
    };
    map.once('load', handleMapLoad);

    let resizeObserver: ResizeObserver | undefined;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        mapRef.current?.resize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver?.disconnect();

      const draw = drawRef.current;

      if (draw) {
        draw.off('finish', handleDrawFinish);
        draw.off('change', handleDrawChange);
        draw.off('select', handleFeatureSelect);
        draw.off('deselect', handleFeatureDeselect);
        // Removes the drawing library's layers/sources/listeners from the map, and must run before `map.remove()`
        draw.stop();
        drawRef.current = null;
      }

      map.remove();
      mapRef.current = null;
    };
  }, [syncFeaturesIntoDraw]);

  useDeepCompareEffect(() => {
    syncFeaturesIntoDraw(features ?? []);
  }, [features ?? []]);

  // The drawing library's mode is state of its own, so it has to be re-reconciled with the props on every change to
  // them, not only when editability flips. A mode whose control has since been withdrawn keeps interpreting map
  // clicks even though the toolbar no longer offers a way out of it.
  //
  // Deep compared: `drawControls` is an object a consumer typically writes inline, so a reference comparison would
  // reconcile on every render and drop the user out of the mode they are drawing in.
  useDeepCompareEffect(() => {
    const draw = drawRef.current;

    if (!draw) {
      // The map has not loaded yet; the load handler applies the initial mode
      return;
    }

    if (!isEditable) {
      if (selectedFeatureIdRef.current !== null) {
        draw.deselectFeature(selectedFeatureIdRef.current);
      }

      // The built-in `static` mode ignores all map interactions
      draw.setMode('static');
      setActiveDrawMode(null);
      setSelectedFeatureId(null);
      selectedFeatureIdRef.current = null;

      return;
    }

    const currentMode = draw.getMode();

    // Already in the neutral mode, or in a draw mode the consumer still offers: leave the user where they are.
    if (currentMode === 'select' || isDrawModeEnabled(currentMode, drawControls)) {
      return;
    }

    // Either `static`, because the map has just become editable, or a draw mode whose control has been withdrawn.
    draw.setMode('select');
    setActiveDrawMode(null);
    setSelectedFeatureId(null);
    selectedFeatureIdRef.current = null;
  }, [isEditable, drawControls ?? {}]);

  /**
   * Activates the provided draw mode, or returns to the select mode when `null`.
   */
  const handleSelectMode = (mode: SlippyMapDrawMode | null) => {
    const draw = drawRef.current;

    if (!draw) {
      return;
    }

    draw.setMode(mode ?? 'select');
    setActiveDrawMode(mode);
  };

  /**
   * Deletes the currently selected feature and emits the delete callback with the remaining features.
   */
  const handleTrash = () => {
    const draw = drawRef.current;
    const selectedId = selectedFeatureIdRef.current;

    if (!draw || selectedId === null) {
      return;
    }

    isSyncingRef.current = true;
    try {
      draw.deselectFeature(selectedId);
      draw.removeFeatures([selectedId]);
    } finally {
      isSyncingRef.current = false;
    }

    selectedFeatureIdRef.current = null;
    setSelectedFeatureId(null);

    callbacksRef.current.onDrawDelete?.(extractSnapshotFeatures(draw.getSnapshot()));
  };

  return (
    <Box
      id={id}
      data-testid="slippy-map"
      sx={[{ position: 'relative', overflow: 'hidden' }, ...(Array.isArray(sx) ? sx : [sx ?? false])]}>
      <Box ref={containerRef} data-testid="slippy-map-container" sx={{ position: 'absolute', inset: 0 }} />
      {isEditable && (
        <SlippyMapDrawToolbar
          drawControls={drawControls ?? {}}
          activeDrawMode={activeDrawMode}
          isTrashEnabled={selectedFeatureId !== null}
          onSelectMode={handleSelectMode}
          onTrash={handleTrash}
        />
      )}
    </Box>
  );
};
