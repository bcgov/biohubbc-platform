import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SkeletonMap } from 'components/loading/SkeletonLoaders';
import { buildBasemapLayer, buildBasemapSource, BASEMAP_SOURCE_ID } from 'components/map/basemap-layers';
import { SlippyMap } from 'components/map/SlippyMap';
import { MAP_FIT_MAX_ZOOM, MAP_FIT_PADDING, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from 'constants/spatial';
import { useConfigContext } from 'hooks/useContext';
import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';
import { useCallback, useMemo } from 'react';
import { buildFeatureLayers, buildFeatureTileSource, FEATURE_GEOMETRIES_SOURCE_ID } from './feature-map-layers';
import { useSubmissionFeatureTileSession } from './useSubmissionFeatureTileSession';

export interface ISubmissionFeatureMapProps {
  submissionId: number;
  submissionFeatureId: number;
}

/** Height of the map section. Tall enough to give an extent context, short enough to leave the page scannable. */
const MAP_HEIGHT = 400;

/**
 * Map of a submission feature's spatial properties.
 *
 * Owns everything specific to a submission feature: requesting the tile session, attaching the tile token, and framing
 * the map on the feature's extent. `SlippyMap` receives only generic map configuration.
 *
 * Every failure here is contained to this section. The page's other sections do not depend on it, so a map that cannot
 * load reports it in place and leaves the rest of the page working.
 *
 * @param {ISubmissionFeatureMapProps} props
 * @return {*}
 */
export const SubmissionFeatureMap = (props: ISubmissionFeatureMapProps) => {
  const { submissionId, submissionFeatureId } = props;

  const config = useConfigContext();

  const { status, session, tokenRef, reloadNonce, retry, onTileError } = useSubmissionFeatureTileSession(
    submissionId,
    submissionFeatureId
  );

  const tileSources = useMemo((): Record<string, SourceSpecification> => {
    const sources: Record<string, SourceSpecification> = {};

    if (config?.BASEMAP_URL) {
      sources[BASEMAP_SOURCE_ID] = buildBasemapSource(config.BASEMAP_URL, config.BASEMAP_ATTRIBUTION ?? '');
    }

    if (session) {
      sources[FEATURE_GEOMETRIES_SOURCE_ID] = buildFeatureTileSource(
        session.martin_url_template,
        `${submissionId}:${submissionFeatureId}`,
        session.min_zoom,
        session.max_zoom
      );
    }

    return sources;
  }, [config?.BASEMAP_URL, config?.BASEMAP_ATTRIBUTION, session, submissionId, submissionFeatureId]);

  const layers = useMemo((): LayerSpecification[] => {
    const mapLayers: LayerSpecification[] = [];

    if (config?.BASEMAP_URL) {
      mapLayers.push(buildBasemapLayer());
    }

    if (session) {
      mapLayers.push(...buildFeatureLayers(session.source_layer));
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

  const handleSourceError = useCallback(
    (sourceId: string) => {
      // Only the tile source is worth recovering from; a basemap failure is the provider's problem.
      if (sourceId === FEATURE_GEOMETRIES_SOURCE_ID) {
        onTileError();
      }
    },
    [onTileError]
  );

  if (status === 'loading') {
    return <SkeletonMap />;
  }

  if (status === 'empty') {
    return (
      <Box data-testid="submission-feature-map-empty" sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          This feature has no spatial properties.
        </Typography>
      </Box>
    );
  }

  if (status === 'error' || !session) {
    return (
      <Box
        data-testid="submission-feature-map-error"
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 4 }}>
        <Typography variant="body2" color="text.secondary">
          The map could not be loaded.
        </Typography>
        <Button onClick={retry}>Try again</Button>
      </Box>
    );
  }

  const [minX, minY, maxX, maxY] = session.bbox;

  return (
    <Box data-testid="submission-feature-map" sx={{ position: 'relative', height: MAP_HEIGHT }}>
      <SlippyMap
        // A different feature means different geometry to frame, so the map is rebuilt rather than re-aimed: the
        // initial viewport is a construction-time option. A recovery or manual retry bumps reloadNonce to force a
        // remount that re-requests the tiles; a token-only refresh before expiry changes neither and never remounts.
        key={`${submissionId}:${submissionFeatureId}:${reloadNonce}`}
        readOnly
        mapOptions={{
          minZoom: MAP_MIN_ZOOM,
          maxZoom: MAP_MAX_ZOOM,
          // `bounds` overrides center and zoom, framing the feature's combined extent. The fit is capped because a
          // feature recorded as a single point has no extent, and fitting it literally would open fully zoomed in.
          bounds: [
            [minX, minY],
            [maxX, maxY]
          ],
          fitBoundsOptions: { maxZoom: MAP_FIT_MAX_ZOOM, padding: MAP_FIT_PADDING }
        }}
        tileSources={tileSources}
        layers={layers}
        transformRequest={transformRequest}
        onSourceError={handleSourceError}
        sx={{ height: '100%' }}
      />
    </Box>
  );
};
