import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SkeletonMap } from 'components/loading/SkeletonLoaders';
import { buildBasemapLayer, buildBasemapSource, BASEMAP_SOURCE_ID } from 'components/map/basemap-layers';
import { SlippyMap } from 'components/map/SlippyMap';
import type { ISlippyMapLayer } from 'components/map/SlippyMap.interface';
import { MAP_FIT_MAX_ZOOM, MAP_FIT_PADDING, MAP_MAX_ZOOM, MAP_MIN_ZOOM, MAP_SECTION_HEIGHT } from 'constants/spatial';
import { useConfigContext } from 'hooks/useContext';
import type { SourceSpecification } from 'maplibre-gl';
import { PropsWithChildren, useCallback, useMemo } from 'react';
import { buildFeatureLayers, buildFeatureTileSource, FEATURE_GEOMETRIES_SOURCE_ID } from './feature-map-layers';
import { useSubmissionFeatureTileSession } from './useSubmissionFeatureTileSession';

export interface ISubmissionFeatureMapProps {
  submissionId: number;
  submissionFeatureId: number;
}

/** Height of the map section. Tall enough to give an extent context, short enough to leave the page scannable. */
/**
 * Fixed frame every state of the map section renders inside.
 *
 * The section keeps one footprint whichever state is showing: swapping the map for a loading, empty or error state
 * would otherwise collapse the section and make the surrounding page jump.
 *
 * @param {PropsWithChildren<{ testId: string }>} props
 * @return {*}
 */
const MapFrame = (props: PropsWithChildren<{ testId: string }>) => (
  <Box data-testid={props.testId} sx={{ position: 'relative', display: 'flex', height: MAP_SECTION_HEIGHT }}>
    {props.children}
  </Box>
);

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

  const layers = useMemo((): ISlippyMapLayer[] => {
    const mapLayers: ISlippyMapLayer[] = [];

    if (config?.BASEMAP_URL) {
      mapLayers.push(buildBasemapLayer());
    }

    if (session) {
      mapLayers.push(...buildFeatureLayers(session.source_layer));
    }

    return mapLayers;
  }, [config?.BASEMAP_URL, session]);

  /**
   * Attach the tile token to map requests.
   *
   * Read from a ref at request time rather than captured, so a refreshed token applies to the next request without
   * the map being rebuilt. Requests made before a session exists carry no header.
   */
  const transformRequest = useCallback(
    (url: string) => {
      const token = tokenRef.current;

      if (!token) {
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
    return (
      <MapFrame testId="submission-feature-map-loading">
        <SkeletonMap />
      </MapFrame>
    );
  }

  if (status === 'empty') {
    return (
      <MapFrame testId="submission-feature-map-empty">
        <Box sx={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            This feature has no spatial properties.
          </Typography>
        </Box>
      </MapFrame>
    );
  }

  if (status === 'error' || !session) {
    return (
      <MapFrame testId="submission-feature-map-error">
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

  const [minX, minY, maxX, maxY] = session.bbox;

  return (
    <MapFrame testId="submission-feature-map">
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
        sx={{ flex: '1 1 auto' }}
      />
    </MapFrame>
  );
};
