import Box from '@mui/material/Box';
import type { Feature } from 'geojson';
import { useDeepCompareEffect } from 'hooks/useDeepCompareEffect';
import { Map as MapLibreMap, type MapMouseEvent } from 'maplibre-gl';
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
import type { ISlippyMapLayer, ISlippyMapProps, SlippyMapDrawMode } from './SlippyMap.interface';
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
 * Prefix of the map layer ids the drawing library registers. Passed to the adapter explicitly (rather than relying
 * on its default) because consumer layers are inserted BELOW the first layer carrying this prefix: drawn geometry
 * must always render above tile/basemap content, whichever order the two are (re)applied in.
 */
const TERRA_DRAW_LAYER_PREFIX = 'td';

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
  const {
    id,
    features,
    drawControls,
    readOnly,
    onDrawCreate,
    onDrawUpdate,
    onDrawDelete,
    tileSources,
    layers,
    transformRequest,
    onMapLoad,
    onSourceError,
    sx
  } = props;

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
  const callbacksRef = useRef({ onDrawCreate, onDrawUpdate, onDrawDelete, onMapLoad, onSourceError });
  const featuresRef = useRef<Feature[]>(features ?? []);
  const isEditableRef = useRef(isEditable);
  // Source/layer ids this component applied, so replacing them never touches the drawing library's own
  const appliedSourceIdsRef = useRef<string[]>([]);
  const appliedLayerIdsRef = useRef<string[]>([]);
  const mapContentRef = useRef({ tileSources, layers });
  // Layers that take part in hit testing: those declaring a click handler.
  const interactiveLayersRef = useRef<ISlippyMapLayer[]>([]);
  // Read per request rather than captured at mount, so a rotated credential applies without rebuilding the map
  const transformRequestRef = useRef(transformRequest);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
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
    callbacksRef.current = { onDrawCreate, onDrawUpdate, onDrawDelete, onMapLoad, onSourceError };
    featuresRef.current = features ?? [];
    isEditableRef.current = isEditable;
    mapContentRef.current = { tileSources, layers };
    interactiveLayersRef.current = (layers ?? []).filter((layer) => layer.onClick);
    transformRequestRef.current = transformRequest;
  });

  /**
   * Replaces the sources and layers this component applied with the current props.
   *
   * Layers are removed before their sources (MapLibre rejects removing a source still in use), then re-added in the
   * order given so the consumer controls draw order among its own layers. Every consumer layer is inserted BELOW the
   * drawing library's layers: an opaque basemap added above them would hide drawn geometry entirely, and this holds
   * on every re-apply, not just the first. Only ids this component added are removed, so the drawing library's own
   * sources and layers are left untouched.
   */
  const applyMapContent = useCallback((map: MapLibreMap) => {
    const { tileSources: currentSources, layers: currentLayers } = mapContentRef.current;

    for (const layerId of appliedLayerIdsRef.current) {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    }

    for (const sourceId of appliedSourceIdsRef.current) {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }

    appliedLayerIdsRef.current = [];
    appliedSourceIdsRef.current = [];

    for (const [sourceId, source] of Object.entries(currentSources ?? {})) {
      map.addSource(sourceId, source);
      appliedSourceIdsRef.current.push(sourceId);
    }

    // The lowest drawing-library layer; consumer layers are inserted before (below) it.
    const firstDrawLayerId = map
      .getStyle()
      .layers?.find((layer) => layer.id.startsWith(`${TERRA_DRAW_LAYER_PREFIX}-`))?.id;

    for (const layer of currentLayers ?? []) {
      map.addLayer(layer.specification, firstDrawLayerId);
      appliedLayerIdsRef.current.push(layer.specification.id);
    }
  }, []);

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
      // Stable wrapper around the latest `transformRequest`. MapLibre captures this once, but it reads the ref on
      // every request, so a consumer can rotate a short-lived credential without the map being rebuilt.
      transformRequest: (url, resourceType) => transformRequestRef.current?.(url, resourceType) ?? { url },
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
    /**
     * Routes a click to the handler of the layer that rendered the topmost feature under the cursor.
     */
    const handleMapClick = (event: MapMouseEvent) => {
      const interactiveLayers = interactiveLayersRef.current.filter((layer) => map.getLayer(layer.specification.id));

      if (!interactiveLayers.length) {
        return;
      }

      // Topmost first, so where interactive layers overlap the one drawn on top wins.
      const [topmost] = map.queryRenderedFeatures(event.point, {
        layers: interactiveLayers.map((layer) => layer.specification.id)
      });

      if (!topmost) {
        return;
      }

      interactiveLayers.find((layer) => layer.specification.id === topmost.layer.id)?.onClick?.(topmost);
    };

    /**
     * Shows a pointer cursor over interactive layers, so clickable features look clickable.
     */
    const handleMapMouseMove = (event: MapMouseEvent) => {
      // The drawing library manages the cursor itself in its select and draw modes (crosshair while
      // drawing, move over a draggable feature); writing to the canvas cursor here every mousemove
      // would clobber it. Hover styling only applies in the read-only `static` mode.
      if (drawRef.current?.getMode() !== 'static') {
        return;
      }

      const layerIds = interactiveLayersRef.current
        .map((layer) => layer.specification.id)
        .filter((layerId) => map.getLayer(layerId));

      if (!layerIds.length) {
        return;
      }

      const isOverFeature = map.queryRenderedFeatures(event.point, { layers: layerIds }).length > 0;
      map.getCanvas().style.cursor = isOverFeature ? 'pointer' : '';
    };

    /**
     * Surfaces source load failures, which is how a consumer learns that a tile request was rejected:
     * `transformRequest` only sees outgoing requests, never responses.
     */
    const handleMapError = (event: ErrorEvent & { sourceId?: string }) => {
      const sourceId = event.sourceId;

      if (!sourceId || !appliedSourceIdsRef.current.includes(sourceId)) {
        return;
      }

      callbacksRef.current.onSourceError?.(sourceId, event.error);
    };

    const handleMapLoad = () => {
      const adapter = new TerraDrawMapLibreGLAdapter({ map, prefixId: TERRA_DRAW_LAYER_PREFIX });

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

      // Applied after the drawing library starts, so its layers exist and consumer layers can be
      // inserted below them (drawn geometry always renders on top).
      applyMapContent(map);

      setIsMapLoaded(true);
      callbacksRef.current.onMapLoad?.();
    };
    map.once('load', handleMapLoad);
    map.on('click', handleMapClick);
    map.on('mousemove', handleMapMouseMove);
    map.on('error', handleMapError);

    let resizeObserver: ResizeObserver | undefined;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        // A hidden container measures 0x0 and reports it here — a consumer that keeps the map mounted behind
        // another view (as the search results panel does) hits this on every switch. Resizing the map to nothing
        // would only be undone by the resize back, so it is skipped: the map keeps the dimensions it had, and the
        // observer fires again with the real ones when the container is shown.
        const { width, height } = container.getBoundingClientRect();

        if (!width || !height) {
          return;
        }

        mapRef.current?.resize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver?.disconnect();

      map.off('click', handleMapClick);
      map.off('mousemove', handleMapMouseMove);
      map.off('error', handleMapError);

      appliedLayerIdsRef.current = [];
      appliedSourceIdsRef.current = [];
      setIsMapLoaded(false);

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
    // Both dependencies are stable (`useCallback` with no dependencies), so the map is created once
  }, [syncFeaturesIntoDraw, applyMapContent]);

  useDeepCompareEffect(() => {
    syncFeaturesIntoDraw(features ?? []);
  }, [features ?? []]);

  useDeepCompareEffect(() => {
    const map = mapRef.current;

    if (!map || !isMapLoaded) {
      // The map has not loaded yet; the load handler performs the initial apply
      return;
    }

    applyMapContent(map);
    // Compared against the layer specifications rather than the layers themselves: the click handlers are read from a
    // ref at event time, and a deep compare tests functions by reference, so an inline handler would re-apply (and
    // re-request every tile) on every render.
  }, [tileSources ?? {}, (layers ?? []).map((layer) => layer.specification), isMapLoaded, applyMapContent]);

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
