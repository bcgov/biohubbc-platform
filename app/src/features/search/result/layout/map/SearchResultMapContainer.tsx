import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SkeletonMap } from 'components/loading/SkeletonLoaders';
import { SlippyMap } from 'components/map/SlippyMap';
import type { ISlippyMapLayer, MapClickPosition, SlippyMapHandle } from 'components/map/SlippyMap.interface';
import {
  ALL_OF_BC_BBOX,
  MAP_CLUSTER_ZOOM_INCREMENT,
  MAP_FIT_MAX_ZOOM,
  MAP_FIT_PADDING,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_VIEW_MIN_HEIGHT
} from 'constants/spatial';
import { useConfigContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import type { MapGeoJSONFeature, SourceSpecification } from 'maplibre-gl';
import { PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BASEMAP_SOURCE_ID,
  buildBasemapLayer,
  buildBasemapSource,
  buildSearchResultLayers,
  buildSearchResultsSource,
  SEARCH_RESULTS_SOURCE_ID
} from './map-layers';
import { MapSelection, resolveMapSelection } from './map-selection';
import { SearchResultMapPopper } from './SearchResultMapPopper';
import { useMartinSession } from './useMartinSession';

export interface ISearchResultMapContainerProps {
  /** Feature type currently being searched. */
  featureTypeName: string;
  /** Applied search expression, or null for an unfiltered view. */
  expressionTree: ExpressionTreeExpression | null;
  /**
   * Whether the map view is the one on screen.
   *
   * The result panel keeps this component mounted while the table view is showing, so that returning to the map
   * preserves its viewport and loaded tiles. Nothing else tells it that it is hidden: while false it holds what it
   * has and stops talking to the server, and re-mints on the way back.
   */
  isActive: boolean;
}

/**
 * Fixed frame every state of the map view renders inside.
 *
 * The panel slot this view fills is a row flex container, so an unsized child collapses to its content — swapping the
 * map for a loading or error state would then change the panel's height and make the surrounding search UI jump. One
 * shared frame keeps the footprint identical across states; only the content inside it swaps.
 *
 * @param {PropsWithChildren<{ testId: string }>} props
 * @return {*}
 */
const MapFrame = (props: PropsWithChildren<{ testId: string }>) => (
  <Box
    data-testid={props.testId}
    sx={{ position: 'relative', display: 'flex', flex: '1 1 auto', width: '100%', minHeight: MAP_VIEW_MIN_HEIGHT }}>
    {props.children}
  </Box>
);

/**
 * Map view of the search results.
 *
 * Owns everything search-specific: creating the Martin session, attaching the tile token, replacing the tile source
 * when the search changes, and interpreting cluster selections. `SlippyMap` receives only generic map configuration.
 *
 * @param {ISearchResultMapContainerProps} props
 * @return {*}
 */
export const SearchResultMapContainer = (props: ISearchResultMapContainerProps) => {
  const { featureTypeName, expressionTree, isActive } = props;

  const config = useConfigContext();

  const { status, session, tokenRef, reloadNonce, retry, onTileError } = useMartinSession(
    featureTypeName,
    expressionTree,
    isActive
  );

  const slippyMapRef = useRef<SlippyMapHandle>(null);
  const [selection, setSelection] = useState<MapSelection | null>(null);

  const tileSources = useMemo((): Record<string, SourceSpecification> => {
    const sources: Record<string, SourceSpecification> = {};

    if (config?.BASEMAP_URL) {
      sources[BASEMAP_SOURCE_ID] = buildBasemapSource(config.BASEMAP_URL, config.BASEMAP_ATTRIBUTION ?? '');
    }

    if (session) {
      sources[SEARCH_RESULTS_SOURCE_ID] = buildSearchResultsSource(
        session.martin_url_template,
        session.martin_context_id
      );
    }

    return sources;
  }, [config?.BASEMAP_URL, config?.BASEMAP_ATTRIBUTION, session]);

  /**
   * Interpret a click on a cluster. A cluster whose properties do not resolve to a selection is ignored, leaving any
   * current selection in place, so a malformed tile cannot break the page.
   */
  const handleClusterClick = useCallback((feature: MapGeoJSONFeature, position: MapClickPosition) => {
    const resolved = resolveMapSelection(feature, position);

    if (!resolved) {
      return;
    }

    setSelection(resolved);
  }, []);

  const layers = useMemo((): ISlippyMapLayer[] => {
    const mapLayers: ISlippyMapLayer[] = [];

    if (config?.BASEMAP_URL) {
      mapLayers.push(buildBasemapLayer());
    }

    if (session) {
      mapLayers.push(...buildSearchResultLayers(handleClusterClick));
    }

    return mapLayers;
  }, [config?.BASEMAP_URL, session, handleClusterClick]);

  /**
   * Attach the tile token to tile requests only.
   *
   * Read from a ref at request time, so a refreshed token applies immediately. Scoped to the tile path so the token is
   * never sent to the basemap provider, which is a third party.
   */
  const transformRequest = useCallback(
    (url: string) => {
      const token = tokenRef.current;

      if (!token || !url.startsWith(`${window.location.origin}/martin/`)) {
        return { url };
      }

      return { url, headers: { Authorization: `Bearer ${token}` } };
    },
    [tokenRef]
  );

  const handleEmptyMapClick = useCallback(() => {
    setSelection(null);
  }, []);

  // Any camera movement (pan or zoom, user or programmatic) dismisses the popper: it is anchored to screen
  // coordinates, which stop matching its geography the moment the map moves. This also satisfies "a cluster popper
  // closes when the zoom changes".
  const handleMoveStart = useCallback(() => {
    setSelection(null);
  }, []);

  const handleClosePopper = useCallback(() => {
    setSelection(null);
  }, []);

  /**
   * Zoom into the selected cluster: center on it and zoom in by the configured increment, never past the maximum.
   * Clusters carry no expansion zoom, so the increment always applies. The camera movement itself closes the popper
   * via the move handler.
   */
  const handleZoomIn = useCallback(() => {
    if (!selection) {
      return;
    }

    const currentZoom = slippyMapRef.current?.getZoom() ?? MAP_MIN_ZOOM;

    setSelection(null);
    slippyMapRef.current?.easeTo({
      center: [selection.lngLat.lng, selection.lngLat.lat],
      zoom: Math.min(currentZoom + MAP_CLUSTER_ZOOM_INCREMENT, MAP_MAX_ZOOM)
    });
  }, [selection]);

  // A new result set (new context) or a forced reload rebuilds the map, so any selection made against the old
  // tiles is stale — drop it.
  useEffect(() => {
    setSelection(null);
  }, [session?.martin_context_id, reloadNonce]);

  // Escape dismisses the popper, matching how transient surfaces behave elsewhere.
  useEffect(() => {
    if (!selection) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelection(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selection]);

  const handleSourceError = useCallback(
    (sourceId: string) => {
      // Only the tile source is worth recovering from; a basemap failure is the provider's problem.
      if (sourceId === SEARCH_RESULTS_SOURCE_ID) {
        onTileError();
      }
    },
    [onTileError]
  );

  if (status === 'loading' && !session) {
    return (
      <MapFrame testId="search-result-map-loading">
        <SkeletonMap />
      </MapFrame>
    );
  }

  if (status === 'error' || !session) {
    return (
      <MapFrame testId="search-result-map-error">
        <Box
          sx={{
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            p: 4
          }}>
          <Typography variant="body2" color="text.secondary">
            The map could not be loaded.
          </Typography>
          <Button onClick={retry}>Try again</Button>
        </Box>
      </MapFrame>
    );
  }

  return (
    <MapFrame testId="search-result-map">
      <SlippyMap
        // A new context means a different session, so the map is rebuilt for it. A recovery or manual retry bumps
        // reloadNonce to force a remount that re-requests the tiles; a token-only refresh before expiry changes
        // neither the context id nor the nonce and therefore never remounts.
        key={`${session.martin_context_id}:${reloadNonce}`}
        ref={slippyMapRef}
        readOnly
        mapOptions={{
          minZoom: MAP_MIN_ZOOM,
          maxZoom: MAP_MAX_ZOOM,
          // `bounds` rather than a center and a computed zoom: solving the fit by hand means
          // reimplementing Web Mercator badly. Degrees of latitude and longitude do not cover the
          // same distance on screen — at BC's latitudes a degree of latitude is nearly twice as
          // tall — and the panel's aspect ratio decides which of the two dimensions actually
          // limits the fit. MapLibre already accounts for both. The whole province is the frame:
          // the session carries no extent of its own.
          bounds: [
            [ALL_OF_BC_BBOX[0], ALL_OF_BC_BBOX[1]],
            [ALL_OF_BC_BBOX[2], ALL_OF_BC_BBOX[3]]
          ],
          fitBoundsOptions: { maxZoom: MAP_FIT_MAX_ZOOM, padding: MAP_FIT_PADDING }
        }}
        tileSources={tileSources}
        layers={layers}
        transformRequest={transformRequest}
        onEmptyMapClick={handleEmptyMapClick}
        onMoveStart={handleMoveStart}
        onSourceError={handleSourceError}
        sx={{ flex: '1 1 auto', minHeight: MAP_VIEW_MIN_HEIGHT }}
      />
      {selection && <SearchResultMapPopper selection={selection} onZoomIn={handleZoomIn} onClose={handleClosePopper} />}
    </MapFrame>
  );
};
