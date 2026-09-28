import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SkeletonMap } from 'components/loading/SkeletonLoaders';
import { buildMartinRequestTransform } from 'components/map/martin-request';
import { SlippyMap } from 'components/map/SlippyMap';
import type { ISlippyMapLayer, SlippyMapHandle } from 'components/map/SlippyMap.interface';
import { useBcBasemap } from 'components/map/useBcBasemap';
import {
  MAP_FIT_MAX_ZOOM,
  MAP_FIT_PADDING,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  SUBMISSION_FEATURE_MAP_SECTION_HEIGHT
} from 'constants/spatial';
import {
  buildFeatureLayers,
  buildFeatureTileSource,
  FEATURE_GEOMETRIES_SOURCE_ID
} from 'components/map/geometry-tile-layers';
import { MapFrame } from 'components/map/MapFrame';
import { useSubmissionUploadTileSession } from '../../../components/map/useSubmissionUploadTileSession';
import { ISubmissionUploadFeatureGeometryExtent } from 'interfaces/useAdminApi.interface';
import { useApi } from 'hooks/useApi';
import { useConfigContext } from 'hooks/useContext';
import type { FilterSpecification, SourceSpecification } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface SubmissionUploadReviewMapProps {
  submissionId: number;
  submissionUploadId: string;
  submissionFeatureId: number | null;
}

/**
 * Renders a persistent submission feature map for the security-review workspace.
 *
 * The map mounts with the review page, remains mounted through loading and errors, and recenters or fits a feature once
 * its extent is ready. One upload tile session is shared across all feature selections. A selected feature with no
 * geometry hides the map container while preserving the map instance and viewport.
 *
 * @param {SubmissionUploadReviewMapProps} props - Submission upload review map properties.
 * @returns {JSX.Element} Rendered submission upload review map.
 */
export const SubmissionUploadReviewMap = (props: SubmissionUploadReviewMapProps) => {
  const config = useConfigContext();
  const api = useApi();
  const [hasMapLoaded, setHasMapLoaded] = useState(false);
  const subjectKey = `${props.submissionId}:${props.submissionUploadId}`;
  const featureKey = `${subjectKey}:${props.submissionFeatureId}`;
  const {
    status,
    session: currentSession,
    tokenRef,
    reloadNonce,
    retry,
    onTileError
  } = useSubmissionUploadTileSession(props.submissionId, props.submissionUploadId);
  const [extent, setExtent] = useState<ISubmissionUploadFeatureGeometryExtent & { key: string; error?: boolean }>();
  const [extentRevision, setExtentRevision] = useState(0);
  const currentExtent = extent?.key === featureKey ? extent : undefined;

  useEffect(() => {
    if (props.submissionFeatureId === null) {
      return;
    }
    const controller = new AbortController();
    const submissionFeatureId = props.submissionFeatureId;

    /** Load the selected feature's extent, ignoring responses after cancellation. */
    const loadExtent = async (): Promise<void> => {
      try {
        const response = await api.admin.getSubmissionUploadFeatureGeometryExtent(
          props.submissionId,
          props.submissionUploadId,
          submissionFeatureId,
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) {
          setExtent({ ...response, key: featureKey });
        }
      } catch {
        if (!controller.signal.aborted) {
          setExtent({ key: featureKey, bbox: null, geometry_count: 0, error: true });
        }
      }
    };

    void loadExtent();
    return () => controller.abort();
  }, [api, props.submissionId, props.submissionUploadId, props.submissionFeatureId, featureKey, extentRevision]);

  // Loading is an initial-map concern; switching the selected feature must not cover the retained map.
  const isLoading = !hasMapLoaded && status === 'loading';
  const mapRef = useRef<SlippyMapHandle | null>(null);
  const hasManualZoomRef = useRef(false);
  const framedSubjectRef = useRef<string | null>(null);

  const bcBasemap = useBcBasemap(config?.BASEMAP_URL, config?.BASEMAP_ATTRIBUTION);

  const tileSources = useMemo((): Record<string, SourceSpecification> => {
    const sources: Record<string, SourceSpecification> = { ...bcBasemap.tileSources };
    if (currentSession) {
      sources[FEATURE_GEOMETRIES_SOURCE_ID] = buildFeatureTileSource(
        currentSession.martin_url_template,
        `${subjectKey}:${reloadNonce}`,
        currentSession.min_zoom,
        currentSession.max_zoom
      );
    }
    return sources;
  }, [bcBasemap.tileSources, currentSession, subjectKey, reloadNonce]);

  const layers = useMemo((): ISlippyMapLayer[] => {
    const mapLayers: ISlippyMapLayer[] = [...bcBasemap.layers];
    if (currentSession) {
      mapLayers.push(
        ...buildFeatureLayers(currentSession.source_layer).map((layer) => ({
          ...layer,
          specification: {
            ...layer.specification,
            // The upload session authorizes every upload feature; this filter controls presentation only.
            filter: [
              'all',
              'filter' in layer.specification ? layer.specification.filter : true,
              ['==', ['get', 'submission_feature_id'], props.submissionFeatureId ?? -1]
            ] as FilterSpecification
          }
        }))
      );
    }
    return mapLayers;
  }, [bcBasemap.layers, currentSession, props.submissionFeatureId]);

  const transformRequest = useMemo(
    () => buildMartinRequestTransform(currentSession?.martin_url_template, tokenRef),
    [currentSession?.martin_url_template, tokenRef]
  );

  const handleSourceError = useCallback(
    (sourceId: string) => {
      if (sourceId === FEATURE_GEOMETRIES_SOURCE_ID) {
        onTileError();
      }
    },
    [onTileError]
  );

  useEffect(() => {
    if (!hasMapLoaded || !currentExtent?.bbox || framedSubjectRef.current === featureKey) {
      return;
    }

    const [minX, minY, maxX, maxY] = currentExtent.bbox;
    if (hasManualZoomRef.current) {
      mapRef.current?.easeTo({ center: [(minX + maxX) / 2, (minY + maxY) / 2] });
    } else {
      mapRef.current?.fitBounds(
        [
          [minX, minY],
          [maxX, maxY]
        ],
        { maxZoom: MAP_FIT_MAX_ZOOM, padding: MAP_FIT_PADDING, duration: 300 }
      );
    }
    framedSubjectRef.current = featureKey;
  }, [currentExtent, featureKey, hasMapLoaded]);

  // Hide only after the selected feature is confirmed non-spatial; loading and errors are not empty results.
  const hideMap = props.submissionFeatureId !== null && currentExtent?.geometry_count === 0 && !currentExtent.error;

  return (
    <Box sx={{ display: hideMap ? 'none' : 'block' }}>
      <MapFrame testId="submission-upload-review-map" height={SUBMISSION_FEATURE_MAP_SECTION_HEIGHT}>
        {/* Keep the map mounted: feature selection updates filters; tile recovery replaces sources, never the map instance. */}
        <SlippyMap
          ref={mapRef}
          readOnly
          mapStyle={config?.BASEMAP_FALLBACK_STYLE_URL || undefined}
          mapOptions={{
            minZoom: MAP_MIN_ZOOM,
            maxZoom: MAP_MAX_ZOOM
          }}
          tileSources={tileSources}
          layers={layers}
          transformRequest={transformRequest}
          onMapLoad={() => setHasMapLoaded(true)}
          onSourceError={handleSourceError}
          onViewportChange={bcBasemap.onViewportChange}
          onUserZoom={() => {
            hasManualZoomRef.current = true;
          }}
          sx={{ flex: '1 1 auto' }}
        />
        {isLoading && (
          <Box data-testid="submission-upload-review-map-loading" sx={{ position: 'absolute', inset: 0 }}>
            <SkeletonMap />
          </Box>
        )}
        {(status === 'error' || currentExtent?.error) && (
          <Box
            data-testid="submission-upload-review-map-error"
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              right: 16,
              p: 2,
              borderRadius: 1,
              bgcolor: 'background.paper',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1
            }}>
            <Typography variant="body2" color="text.secondary">
              Feature map data could not be loaded.
            </Typography>
            <Button
              onClick={() => {
                if (status === 'error') {
                  retry();
                }
                if (currentExtent?.error) {
                  setExtentRevision((revision) => revision + 1);
                }
              }}>
              Try again
            </Button>
          </Box>
        )}
      </MapFrame>
    </Box>
  );
};
