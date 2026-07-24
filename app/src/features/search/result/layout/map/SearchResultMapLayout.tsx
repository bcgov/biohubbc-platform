import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SkeletonMap } from 'components/loading/SkeletonLoaders';
import { SlippyMap } from 'components/map/SlippyMap';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { ALL_OF_BC_BOUNDARY, MAP_FIT_MAX_ZOOM, MAP_FIT_PADDING, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from 'constants/spatial';
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
import { useMartinSession } from './useMartinSession';

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
 * Map view of the search results.
 *
 * Owns everything search-specific: creating the Martin session, attaching the tile token, replacing the tile source when
 * the search changes, and navigating to a feature. `SlippyMap` receives only generic map configuration.
 *
 * @param {ISearchResultMapLayoutProps} props
 * @return {*}
 */
export const SearchResultMapLayout = (props: ISearchResultMapLayoutProps) => {
  const { featureTypeName, expressionTree, onResultClick } = props;

  const config = useConfigContext();

  const { status, session, cap, tokenRef, reloadNonce, retry, onTileError } = useMartinSession(
    featureTypeName,
    expressionTree,
    true
  );

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

      if (!token || !url.startsWith(`${window.location.origin}/martin/`)) {
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
        onTileError();
      }
    },
    [onTileError]
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
        <Button onClick={retry}>Try again</Button>
      </Box>
    );
  }

  // An unfiltered search has no extent of its own, so it opens on the whole province.
  const [minX, minY, maxX, maxY] = session.bbox ?? BC_BOUNDS;
  const hasNoMappableResults = session.feature_count === 0;

  return (
    <Box data-testid="search-result-map" sx={{ position: 'relative', flex: '1 1 auto', minHeight: 500 }}>
      <SlippyMap
        // A new context means a different result set, so the map is rebuilt to reframe on its extent. A recovery or
        // manual retry bumps reloadNonce to force a remount that re-requests the tiles; a token-only refresh before
        // expiry changes neither the context id nor the nonce and therefore never remounts.
        key={`${session.martin_context_id}:${reloadNonce}`}
        readOnly
        mapOptions={{
          minZoom: MAP_MIN_ZOOM,
          maxZoom: MAP_MAX_ZOOM,
          // `bounds` rather than a center and a computed zoom: solving the fit by hand means
          // reimplementing Web Mercator badly. Degrees of latitude and longitude do not cover the
          // same distance on screen — at BC's latitudes a degree of latitude is nearly twice as
          // tall — and the panel's aspect ratio decides which of the two dimensions actually
          // limits the fit. MapLibre already accounts for both.
          bounds: [
            [minX, minY],
            [maxX, maxY]
          ],
          // A search that matched a single point has no extent; fitting it literally would open
          // fully zoomed in, so the initial fit is capped.
          fitBoundsOptions: { maxZoom: MAP_FIT_MAX_ZOOM, padding: MAP_FIT_PADDING }
        }}
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
