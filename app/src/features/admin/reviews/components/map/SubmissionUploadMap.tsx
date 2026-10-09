import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonMap } from 'components/loading/SkeletonLoaders';
import {
  buildFeatureLayers,
  buildFeatureTileSource,
  FEATURE_GEOMETRIES_SOURCE_ID
} from 'components/map/geometry-tile-layers';
import { MapFrame } from 'components/map/MapFrame';
import { buildMartinRequestTransform } from 'components/map/martin-request';
import { SlippyMap } from 'components/map/SlippyMap';
import type { ISlippyMapLayer, SlippyMapHandle } from 'components/map/SlippyMap.interface';
import { useBcBasemap } from 'components/map/useBcBasemap';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { MAP_FIT_MAX_ZOOM, MAP_FIT_PADDING, MAP_MAX_ZOOM, MAP_MIN_ZOOM, MAP_SECTION_HEIGHT } from 'constants/spatial';
import { useConfigContext } from 'hooks/useContext';
import { ReconciliationType } from 'interfaces/useAdminApi.interface';
import type { SourceSpecification } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSubmissionUploadMapKey, useSubmissionUploadTileSession } from './useSubmissionUploadTileSession';

export interface ISubmissionUploadMapProps {
  submissionId: number;
  submissionUploadId: string;
  /** Limit the map to features with this reconciliation outcome. Every active feature is mapped when omitted. */
  reconciliation?: ReconciliationType;
}

/**
 * Map of the spatial properties of every active feature of a submission upload, or of those with one reconciliation
 * outcome, for the upload and upload review pages.
 *
 * The map instance mounts with the first tile session, so a subject with no spatial properties never builds a map or
 * requests basemap tiles. Once mounted it stays mounted: a different upload or outcome mints a new tile session, which
 * replaces the geometry source and re-frames the viewport on the new extent, and a tile recovery or retry replaces
 * the source too. The loading, empty and error states are drawn over the map rather than in its place. A failure is
 * contained to this section, so the rest of the page stays usable.
 *
 * @param {ISubmissionUploadMapProps} props Upload to map, and the outcome to limit it to.
 * @returns {JSX.Element} The map section with whichever state applies drawn over it.
 */
export const SubmissionUploadMap = (props: ISubmissionUploadMapProps) => {
  const { submissionId, submissionUploadId, reconciliation } = props;

  const config = useConfigContext();
  const mapKey = getSubmissionUploadMapKey(submissionId, submissionUploadId, reconciliation);
  const { status, session, tokenRef, reloadNonce, retry, onTileError } = useSubmissionUploadTileSession(
    submissionId,
    submissionUploadId,
    reconciliation
  );
  const [hasSession, setHasSession] = useState(false);
  const [hasMapLoaded, setHasMapLoaded] = useState(false);
  const [hasFramed, setHasFramed] = useState(false);
  const mapRef = useRef<SlippyMapHandle | null>(null);
  const framedExtentRef = useRef<string | null>(null);

  const bcBasemap = useBcBasemap(config?.BASEMAP_URL, config?.BASEMAP_ATTRIBUTION);

  const tileSources = useMemo((): Record<string, SourceSpecification> => {
    const sources: Record<string, SourceSpecification> = { ...bcBasemap.tileSources };

    if (session) {
      // The key cache-busts the tile URL, so the browser never serves another subject's tiles; the nonce re-requests
      // the tiles after a recovery or retry without rebuilding the map.
      sources[FEATURE_GEOMETRIES_SOURCE_ID] = buildFeatureTileSource(
        session.martin_url_template,
        reloadNonce ? `${mapKey}:${reloadNonce}` : mapKey,
        session.min_zoom,
        session.max_zoom
      );
    }

    return sources;
  }, [bcBasemap.tileSources, session, mapKey, reloadNonce]);

  const layers = useMemo((): ISlippyMapLayer[] => {
    const mapLayers: ISlippyMapLayer[] = [...bcBasemap.layers];

    if (session) {
      mapLayers.push(...buildFeatureLayers(session.source_layer));
    }

    return mapLayers;
  }, [bcBasemap.layers, session]);

  // Only Martin tiles carry the token; the basemap style and its assets are requested as MapLibre built them.
  const transformRequest = useMemo(
    () => buildMartinRequestTransform(session?.martin_url_template, tokenRef),
    [session?.martin_url_template, tokenRef]
  );

  const handleSourceError = useCallback(
    (sourceId: string) => {
      // Only the tile source is recoverable here: a rejected tile means the token or context expired.
      if (sourceId === FEATURE_GEOMETRIES_SOURCE_ID) {
        onTileError();
      }
    },
    [onTileError]
  );

  // The first session is what mounts the map; later sessions, or their absence, leave it mounted.
  useEffect(() => {
    if (session) {
      setHasSession(true);
    }
  }, [session]);

  // Frame each new extent once. Keyed on the extent rather than the subject, so a token refresh leaves the viewport
  // alone and a session about to be replaced is never framed under the next subject's name.
  useEffect(() => {
    const extent = session?.bbox.join(',');

    if (!hasMapLoaded || !session || framedExtentRef.current === extent) {
      return;
    }

    const [minX, minY, maxX, maxY] = session.bbox;

    // The fit is capped because a subject recorded as a single point has no extent, and fitting it literally would
    // open fully zoomed in. Only a re-frame is animated; the first opens directly on the extent.
    mapRef.current?.fitBounds(
      [
        [minX, minY],
        [maxX, maxY]
      ],
      { maxZoom: MAP_FIT_MAX_ZOOM, padding: MAP_FIT_PADDING, duration: framedExtentRef.current === null ? 0 : 300 }
    );
    framedExtentRef.current = extent ?? null;
    setHasFramed(true);
  }, [hasMapLoaded, session]);

  // Loading is an initial-map concern; a later session must not cover the retained map.
  const isLoading = !hasFramed && status !== 'empty' && status !== 'error';

  return (
    <MapFrame testId="submission-upload-map" height={MAP_SECTION_HEIGHT}>
      {(session || hasSession) && (
        <SlippyMap
          ref={mapRef}
          readOnly
          mapStyle={config?.BASEMAP_FALLBACK_STYLE_URL || undefined}
          mapOptions={{ minZoom: MAP_MIN_ZOOM, maxZoom: MAP_MAX_ZOOM }}
          tileSources={tileSources}
          layers={layers}
          transformRequest={transformRequest}
          onMapLoad={() => setHasMapLoaded(true)}
          onSourceError={handleSourceError}
          onViewportChange={bcBasemap.onViewportChange}
          sx={{ flex: '1 1 auto' }}
        />
      )}
      {/* The states are drawn over the map, which once mounted stays mounted beneath them. */}
      <LoadingGuard
        isLoading={isLoading}
        isLoadingFallback={
          <Box
            data-testid="submission-upload-map-loading"
            sx={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex' }}>
            <SkeletonMap />
          </Box>
        }>
        <ComponentSwitch
          switch={status}
          components={{
            empty: (
              <Box
                data-testid="submission-upload-map-empty"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  p: 2,
                  bgcolor: 'background.paper'
                }}>
                <Typography variant="body2" color="text.secondary">
                  {reconciliation
                    ? 'No features with this outcome have spatial properties.'
                    : 'This upload has no spatial properties.'}
                </Typography>
              </Box>
            ),
            error: (
              <Box
                data-testid="submission-upload-map-error"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  p: 2,
                  bgcolor: 'background.paper'
                }}>
                <Typography variant="body2" color="text.secondary">
                  The map could not be loaded.
                </Typography>
                <Button onClick={retry}>Try again</Button>
              </Box>
            )
          }}
        />
      </LoadingGuard>
    </MapFrame>
  );
};
