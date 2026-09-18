import {
  buildFeatureLayers,
  buildFeatureTileSource,
  FEATURE_GEOMETRIES_SOURCE_ID
} from 'components/map/geometry-tile-layers';
import { buildMartinRequestTransform } from 'components/map/martin-request';
import { SlippyMap } from 'components/map/SlippyMap';
import { TileSessionFrame } from 'components/map/TileSessionFrame';
import type { ISlippyMapLayer } from 'components/map/SlippyMap.interface';
import { useBcBasemap } from 'components/map/useBcBasemap';
import type { UseTileExtentSessionResult } from 'components/map/useTileExtentSession';
import { MAP_FIT_MAX_ZOOM, MAP_FIT_PADDING, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from 'constants/spatial';
import { useConfigContext } from 'hooks/useContext';
import type { SourceSpecification } from 'maplibre-gl';
import { useCallback, useMemo } from 'react';

export interface ITileExtentMapProps {
  /**
   * Identifies the mapped subject. Cache-busts the tile URL (so the browser never serves a previous subject's tiles)
   * and keys the map, so a new subject rebuilds it and re-frames the viewport.
   */
  subjectKey: string;
  /** The tile session for the subject, from {@link useTileExtentSession}. */
  tileSession: UseTileExtentSessionResult;
  /** Message shown when the subject has no spatial properties to map. */
  emptyMessage: string;
  /** Test id of the ready frame. The other states use `${testId}-loading`, `${testId}-empty` and `${testId}-error`. */
  testId: string;
  /** Height of the section, in pixels. */
  height: number;
}

/**
 * Map section for a subject with a fixed extent: a submission feature's spatial properties, or those of every active
 * feature of a submission upload.
 *
 * Owns everything the two subjects have in common: attaching the tile token, composing the basemap with the geometry
 * layers and framing the map on the session's extent; the loading, empty, error and ready states are
 * {@link TileSessionFrame}'s. The caller owns the session (which decides what is being mapped) and the wording.
 *
 * Every failure here is contained to this section. The page's other sections do not depend on it, so a map that cannot
 * load reports it in place and leaves the rest of the page working.
 *
 * @param {ITileExtentMapProps} props
 * @return {*}
 */
export const TileExtentMap = (props: ITileExtentMapProps) => {
  const { subjectKey, tileSession, emptyMessage, testId, height } = props;
  const { status, session, tokenRef, reloadNonce, retry, onTileError } = tileSession;

  const config = useConfigContext();

  const bcBasemap = useBcBasemap(config?.BASEMAP_URL, config?.BASEMAP_ATTRIBUTION);

  const tileSources = useMemo((): Record<string, SourceSpecification> => {
    const sources: Record<string, SourceSpecification> = { ...bcBasemap.tileSources };

    if (session) {
      sources[FEATURE_GEOMETRIES_SOURCE_ID] = buildFeatureTileSource(
        session.martin_url_template,
        subjectKey,
        session.min_zoom,
        session.max_zoom
      );
    }

    return sources;
  }, [bcBasemap.tileSources, session, subjectKey]);

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

  return (
    <TileSessionFrame
      testId={testId}
      height={height}
      status={status}
      session={session}
      onRetry={retry}
      emptyMessage={emptyMessage}>
      {(current) => {
        const [minX, minY, maxX, maxY] = current.bbox;

        return (
          <SlippyMap
            // A different subject means different geometry to frame, so the map is rebuilt rather than re-aimed: the
            // initial viewport is a construction-time option. A recovery or manual retry bumps reloadNonce to force a
            // remount that re-requests the tiles; a token-only refresh before expiry changes neither and never
            // remounts.
            key={`${subjectKey}:${reloadNonce}`}
            readOnly
            mapStyle={config?.BASEMAP_FALLBACK_STYLE_URL || undefined}
            mapOptions={{
              minZoom: MAP_MIN_ZOOM,
              maxZoom: MAP_MAX_ZOOM,
              // `bounds` overrides center and zoom, framing the subject's combined extent. The fit is capped because
              // a subject recorded as a single point has no extent, and fitting it literally would open fully zoomed
              // in.
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
            onViewportChange={bcBasemap.onViewportChange}
            sx={{ flex: '1 1 auto' }}
          />
        );
      }}
    </TileSessionFrame>
  );
};
