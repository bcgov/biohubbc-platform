import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SkeletonMap } from 'components/loading/SkeletonLoaders';
import { SlippyMap } from 'components/map/SlippyMap';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { ALL_OF_BC_BOUNDARY, MAP_DEFAULT_ZOOM, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from 'constants/spatial';
import { useConfigContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import type { LayerSpecification, MapGeoJSONFeature, SourceSpecification } from 'maplibre-gl';
import { useCallback, useMemo } from 'react';
import {
  BASEMAP_SOURCE_ID,
  buildBasemapLayer,
  buildBasemapSource,
  buildSearchResultLayers,
  buildSearchResultsSource,
  INTERACTIVE_LAYER_IDS,
  SEARCH_RESULTS_SOURCE_ID
} from './map-layers';
import { useTileSession } from './useTileSession';

export interface ISearchResultMapLayoutProps {
  /** Feature type currently being searched. */
  featureTypeName: string;
  /** Applied search expression, or null for an unfiltered view. */
  expressionTree: ExpressionTreeExpression | null;
  /** Called when a rendered feature is selected, to navigate to its detail page. */
  onResultClick: (result: { submission_id: number; submission_feature_id: number }) => void;
}

/**
 * Extent of British Columbia, used when a search has no extent of its own (an unfiltered view returns no bbox).
 */
const BC_BOUNDS = ((): [number, number, number, number] => {
  const geometry = ALL_OF_BC_BOUNDARY.geometry;

  if (geometry.type !== 'Polygon') {
    // The constant is a Polygon; this is only here so a future change to it fails loudly rather than silently.
    return [-139, 48, -114, 60];
  }

  const [ring] = geometry.coordinates;
  const longitudes = ring.map(([longitude]) => longitude);
  const latitudes = ring.map(([, latitude]) => latitude);

  return [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)];
})();

/**
 * Compute a centre and zoom that frame a bounding box.
 *
 * MapLibre expects `[longitude, latitude]`, which is the opposite order to the app's older Leaflet-era helpers, so
 * this deliberately does not reuse them.
 */
const framingFor = (bbox: [number, number, number, number] | null): { center: [number, number]; zoom: number } => {
  const [minX, minY, maxX, maxY] = bbox ?? BC_BOUNDS;
  const center: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2];

  const span = Math.max(Math.abs(maxX - minX), Math.abs(maxY - minY));

  if (!span) {
    return { center, zoom: MAP_DEFAULT_ZOOM };
  }

  // 360 degrees spans the world at zoom 0, and each zoom level halves that.
  const zoom = Math.log2(360 / span);

  return { center, zoom: Math.min(Math.max(zoom, MAP_MIN_ZOOM), MAP_MAX_ZOOM) };
};

/**
 * Map view of the search results.
 *
 * Owns everything search-specific: creating the tile session, attaching the tile token, replacing the tile source when
 * the search changes, and navigating to a feature. `SlippyMap` receives only generic map configuration.
 *
 * @param {ISearchResultMapLayoutProps} props
 * @return {*}
 */
export const SearchResultMapLayout = (props: ISearchResultMapLayoutProps) => {
  const { featureTypeName, expressionTree, onResultClick } = props;

  const config = useConfigContext();

  const { status, session, cap, tokenRef, refresh } = useTileSession(featureTypeName, expressionTree, true);

  const tileSources = useMemo((): Record<string, SourceSpecification> => {
    const sources: Record<string, SourceSpecification> = {};

    if (config?.BASEMAP_URL) {
      sources[BASEMAP_SOURCE_ID] = buildBasemapSource(config.BASEMAP_URL, config.BASEMAP_ATTRIBUTION ?? '');
    }

    if (session) {
      sources[SEARCH_RESULTS_SOURCE_ID] = buildSearchResultsSource(session.tile_url_template, session.tile_context_id);
    }

    return sources;
  }, [config?.BASEMAP_URL, config?.BASEMAP_ATTRIBUTION, session]);

  const layers = useMemo((): LayerSpecification[] => {
    const mapLayers: LayerSpecification[] = [];

    if (config?.BASEMAP_URL) {
      mapLayers.push(buildBasemapLayer());
    }

    if (session) {
      mapLayers.push(...buildSearchResultLayers());
    }

    return mapLayers;
  }, [config?.BASEMAP_URL, session]);

  /**
   * Attach the tile token to tile requests only.
   *
   * Read from a ref at request time, so a refreshed token applies immediately. Scoped to the tile path so the token is
   * never sent to the basemap provider, which is a third party.
   */
  const transformRequest = useCallback(
    (url: string) => {
      const token = tokenRef.current;

      if (!token || !url.startsWith(`${window.location.origin}/tiles/`)) {
        return { url };
      }

      return { url, headers: { Authorization: `Bearer ${token}` } };
    },
    [tokenRef]
  );

  const handleFeatureClick = useCallback(
    (features: MapGeoJSONFeature[]) => {
      const properties = features[0]?.properties;

      if (!properties) {
        return;
      }

      const submissionId = Number(properties.submission_id);
      const submissionFeatureId = Number(properties.submission_feature_id);

      if (!submissionId || !submissionFeatureId) {
        return;
      }

      onResultClick({ submission_id: submissionId, submission_feature_id: submissionFeatureId });
    },
    [onResultClick]
  );

  const handleSourceError = useCallback(
    (sourceId: string) => {
      // Only the tile source is worth recovering from; a basemap failure is the provider's problem.
      if (sourceId === SEARCH_RESULTS_SOURCE_ID) {
        refresh();
      }
    },
    [refresh]
  );

  if (status === 'loading' && !session) {
    return <SkeletonMap />;
  }

  if (status === 'over_cap') {
    return (
      <Box data-testid="search-result-map-over-cap" sx={{ p: 2 }}>
        <AlertBanner severity="warning">
          {`This search matches too many results to display on a map${
            cap ? ` (more than ${cap.toLocaleString()})` : ''
          }. Refine your search to see it mapped.`}
        </AlertBanner>
      </Box>
    );
  }

  if (status === 'error' || !session) {
    return (
      <Box
        data-testid="search-result-map-error"
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 4 }}>
        <Typography variant="body2" color="text.secondary">
          The map could not be loaded.
        </Typography>
        <Button onClick={refresh}>Try again</Button>
      </Box>
    );
  }

  const framing = framingFor(session.bbox);
  const hasNoMappableResults = session.feature_count === 0;

  return (
    <Box data-testid="search-result-map" sx={{ position: 'relative', flex: '1 1 auto', minHeight: 500 }}>
      <SlippyMap
        // A new context means a different result set, so the map is rebuilt to reframe on its extent. Token-only
        // refreshes keep the same context id and therefore never remount.
        key={session.tile_context_id}
        readOnly
        initialCenter={framing.center}
        initialZoom={framing.zoom}
        mapOptions={{ minZoom: MAP_MIN_ZOOM, maxZoom: MAP_MAX_ZOOM }}
        tileSources={tileSources}
        layers={layers}
        interactiveLayerIds={INTERACTIVE_LAYER_IDS}
        transformRequest={transformRequest}
        onFeatureClick={handleFeatureClick}
        onSourceError={handleSourceError}
        sx={{ height: '100%', minHeight: 500 }}
      />
      {hasNoMappableResults && (
        <Box
          data-testid="search-result-map-empty"
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
          <Typography variant="body2" color="text.secondary">
            No results found
          </Typography>
        </Box>
      )}
    </Box>
  );
};
