import { MAP_FIT_MAX_ZOOM } from 'constants/spatial';
import type { ISubmissionFeatureTileSession } from 'interfaces/useMartinApi.interface';
import { act, cleanup, render, screen, waitFor } from 'test-helpers/test-utils';
import {
  FEATURE_FILL_LAYER_ID,
  FEATURE_GEOMETRIES_SOURCE_ID,
  FEATURE_LINE_LAYER_ID,
  FEATURE_OUTLINE_LAYER_ID,
  FEATURE_POINT_LAYER_ID
} from './feature-map-layers';
import { SubmissionFeatureMap } from './SubmissionFeatureMap';

const mocks = vi.hoisted(() => ({
  createSubmissionFeatureTileSession: vi.fn(),
  slippyMapProps: [] as Record<string, any>[],
  // Counts MOUNTS, not renders: a keyed remount is how the component forces tiles to be
  // re-requested, so the recovery tests assert on when a remount happens.
  slippyMapMounts: { count: 0 }
}));

vi.mock('hooks/useApi', () => ({
  useApi: () => ({ martin: { createSubmissionFeatureTileSession: mocks.createSubmissionFeatureTileSession } })
}));

vi.mock('hooks/useContext', () => ({
  useConfigContext: () => ({
    BASEMAP_URL: 'https://basemap.test/{z}/{y}/{x}',
    BASEMAP_ATTRIBUTION: '© Province of British Columbia'
  })
}));

// SlippyMap is exercised by its own suite; here we only care what the feature map hands it.
vi.mock('components/map/SlippyMap', async () => {
  const { useEffect } = await import('react');

  return {
    SlippyMap: (props: Record<string, any>) => {
      mocks.slippyMapProps.push(props);
      useEffect(() => {
        mocks.slippyMapMounts.count += 1;
      }, []);
      return <div data-testid="slippy-map-stub" />;
    }
  };
});

const buildSession = (overrides: Partial<ISubmissionFeatureTileSession> = {}): ISubmissionFeatureTileSession => ({
  has_spatial_properties: true,
  token: 'token-1',
  token_type: 'Bearer',
  token_expires_in: 900,
  source: 'feature',
  source_layer: 'geometries',
  martin_url_template: '/martin/feature/{z}/{x}/{y}',
  bbox: [-125, 48, -120, 52],
  min_zoom: 0,
  max_zoom: 15,
  ...overrides
});

const renderMap = (props: Partial<React.ComponentProps<typeof SubmissionFeatureMap>> = {}) =>
  render(<SubmissionFeatureMap submissionId={12} submissionFeatureId={34} {...props} />);

/** The most recent props SlippyMap was rendered with. */
const latestMapProps = () => mocks.slippyMapProps[mocks.slippyMapProps.length - 1];

const renderReadyMap = async (session = buildSession()) => {
  mocks.createSubmissionFeatureTileSession.mockResolvedValue(session);
  const result = renderMap();
  await waitFor(() => expect(screen.getByTestId('submission-feature-map')).toBeInTheDocument());
  return result;
};

describe('SubmissionFeatureMap', () => {
  beforeEach(() => {
    mocks.slippyMapProps.length = 0;
    mocks.slippyMapMounts.count = 0;
    mocks.createSubmissionFeatureTileSession.mockReset();
    vi.stubGlobal('location', { origin: 'https://biohub.test' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('tile configuration', () => {
    it('requests a tile session for the feature being viewed', async () => {
      await renderReadyMap();

      expect(mocks.createSubmissionFeatureTileSession).toHaveBeenCalledWith(
        12,
        34,
        expect.objectContaining({ signal: expect.anything() })
      );
    });

    it('builds the vector source from the returned template', async () => {
      await renderReadyMap();

      const source = latestMapProps().tileSources[FEATURE_GEOMETRIES_SOURCE_ID];

      expect(source.type).toBe('vector');
      expect(source.tiles[0]).toBe('https://biohub.test/martin/feature/{z}/{x}/{y}?ctx=12%3A34');
      expect(source.minzoom).toBe(0);
      expect(source.maxzoom).toBe(15);
    });

    it('never places the token in the tile url', async () => {
      await renderReadyMap(buildSession({ token: 'super-secret-token' }));

      const source = latestMapProps().tileSources[FEATURE_GEOMETRIES_SOURCE_ID];

      expect(source.tiles[0]).not.toContain('super-secret-token');
    });

    it('attaches the token as an Authorization header on tile requests only', async () => {
      await renderReadyMap(buildSession({ token: 'token-abc' }));

      const { transformRequest } = latestMapProps();

      expect(transformRequest('https://biohub.test/martin/feature/5/5/11')).toEqual({
        url: 'https://biohub.test/martin/feature/5/5/11',
        headers: { Authorization: 'Bearer token-abc' }
      });

      // The basemap is a third party; the tile token must never be sent there.
      expect(transformRequest('https://basemap.test/5/11/5')).toEqual({ url: 'https://basemap.test/5/11/5' });
    });
  });

  describe('layers', () => {
    it('renders each geometry type from the session source layer', async () => {
      await renderReadyMap();

      const layers: any[] = latestMapProps().layers;
      const featureLayers = layers.filter((layer) => layer.source === FEATURE_GEOMETRIES_SOURCE_ID);

      expect(featureLayers.map((layer) => layer.id)).toEqual([
        FEATURE_FILL_LAYER_ID,
        FEATURE_OUTLINE_LAYER_ID,
        FEATURE_LINE_LAYER_ID,
        FEATURE_POINT_LAYER_ID
      ]);

      for (const layer of featureLayers) {
        expect(layer['source-layer']).toBe('geometries');
      }
    });

    it('filters each layer by geometry type, so mixed geometries all stay visible', async () => {
      await renderReadyMap();

      const layers: any[] = latestMapProps().layers;
      const filterFor = (id: string) => layers.find((layer) => layer.id === id)?.filter;

      expect(filterFor(FEATURE_FILL_LAYER_ID)).toEqual(['==', ['geometry-type'], 'Polygon']);
      expect(filterFor(FEATURE_OUTLINE_LAYER_ID)).toEqual(['==', ['geometry-type'], 'Polygon']);
      expect(filterFor(FEATURE_LINE_LAYER_ID)).toEqual(['==', ['geometry-type'], 'LineString']);
      expect(filterFor(FEATURE_POINT_LAYER_ID)).toEqual(['==', ['geometry-type'], 'Point']);
    });

    it('uses the source layer name the session reports rather than a hard coded one', async () => {
      await renderReadyMap(buildSession({ source_layer: 'renamed_layer' }));

      const layers: any[] = latestMapProps().layers;
      const featureLayers = layers.filter((layer) => layer.source === FEATURE_GEOMETRIES_SOURCE_ID);

      for (const layer of featureLayers) {
        expect(layer['source-layer']).toBe('renamed_layer');
      }
    });
  });

  describe('viewport', () => {
    it('fits the combined bounds of the feature', async () => {
      await renderReadyMap(buildSession({ bbox: [-125, 48, -120, 52] }));

      const { mapOptions } = latestMapProps();

      expect(mapOptions.bounds).toEqual([
        [-125, 48],
        [-120, 52]
      ]);
    });

    it('caps how far the initial fit may zoom in', async () => {
      // A feature recorded as a single point has no extent; without the cap the map would open fully
      // zoomed in, showing nothing around it.
      await renderReadyMap(buildSession({ bbox: [-125, 48, -125, 48] }));

      const { mapOptions } = latestMapProps();

      expect(mapOptions.fitBoundsOptions.maxZoom).toBe(MAP_FIT_MAX_ZOOM);
    });
  });

  describe('states', () => {
    it('shows a loading state until the session resolves', async () => {
      mocks.createSubmissionFeatureTileSession.mockReturnValue(new Promise(() => undefined));

      renderMap();

      expect(screen.queryByTestId('submission-feature-map')).not.toBeInTheDocument();
      expect(screen.queryByTestId('submission-feature-map-empty')).not.toBeInTheDocument();
      expect(screen.queryByTestId('submission-feature-map-error')).not.toBeInTheDocument();
    });

    it('reports a feature with no spatial properties, without initializing a source', async () => {
      mocks.createSubmissionFeatureTileSession.mockResolvedValue({ has_spatial_properties: false });

      renderMap();

      await waitFor(() => expect(screen.getByTestId('submission-feature-map-empty')).toBeInTheDocument());
      expect(screen.getByText('This feature has no spatial properties.')).toBeInTheDocument();
      // No vector tile source is created, so nothing is requested from the tile gateway.
      expect(mocks.slippyMapProps).toHaveLength(0);
    });

    it('reports a failure in place, leaving the rest of the page alone', async () => {
      mocks.createSubmissionFeatureTileSession.mockRejectedValue(new Error('nope'));

      renderMap();

      await waitFor(() => expect(screen.getByTestId('submission-feature-map-error')).toBeInTheDocument());
      expect(screen.getByText('The map could not be loaded.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('surfaces a failure to load tiles, after bounded automatic recovery', async () => {
      await renderReadyMap();

      // transformRequest cannot see responses, so a rejected tile reaches the component as a source
      // error. Recovery re-mints a possibly-expired token a bounded number of times before giving up.
      for (let attempt = 0; attempt < 3; attempt++) {
        await act(async () => {
          latestMapProps().onSourceError(FEATURE_GEOMETRIES_SOURCE_ID, new Error('tile request failed'));
        });
      }

      await waitFor(() => expect(screen.getByTestId('submission-feature-map-error')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      // Giving up removes the map entirely; there is no stale session left to render.
      expect(screen.queryByTestId('submission-feature-map')).not.toBeInTheDocument();
    });

    it('holds the map remount until the recovery token has arrived', async () => {
      // The race this pins down: tiles fail (expired token), and remounting the map BEFORE the
      // re-mint resolves would fire a fresh round of tile requests carrying the same dead token -
      // requests MapLibre never retries, leaving a silently blank map.
      await renderReadyMap(buildSession({ token: 'token-1' }));

      let resolveMint: (session: ISubmissionFeatureTileSession) => void = () => undefined;
      mocks.createSubmissionFeatureTileSession.mockImplementationOnce(
        () => new Promise((resolve) => (resolveMint = resolve as (session: ISubmissionFeatureTileSession) => void))
      );

      const mountsBeforeFailure = mocks.slippyMapMounts.count;

      await act(async () => {
        latestMapProps().onSourceError(FEATURE_GEOMETRIES_SOURCE_ID, new Error('tile request failed'));
      });

      // No remount while the re-mint is pending: a remounted map would request its tiles with the
      // old token still in the ref. Failures from the same burst are absorbed without extra mints.
      expect(mocks.slippyMapMounts.count).toBe(mountsBeforeFailure);

      await act(async () => {
        latestMapProps().onSourceError(FEATURE_GEOMETRIES_SOURCE_ID, new Error('tile request failed'));
      });

      expect(mocks.slippyMapMounts.count).toBe(mountsBeforeFailure);
      expect(mocks.createSubmissionFeatureTileSession).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveMint(buildSession({ token: 'token-2' }));
      });

      // Only after the new token is in the ref does the map remount and re-request its tiles.
      await waitFor(() => expect(mocks.slippyMapMounts.count).toBe(mountsBeforeFailure + 1));
      expect(latestMapProps().transformRequest('https://biohub.test/martin/feature/5/5/11')).toEqual({
        url: 'https://biohub.test/martin/feature/5/5/11',
        headers: { Authorization: 'Bearer token-2' }
      });
    });

    it('ignores a basemap failure, which is the provider’s problem and not the feature’s', async () => {
      await renderReadyMap();

      for (let attempt = 0; attempt < 3; attempt++) {
        await act(async () => {
          latestMapProps().onSourceError('basemap', new Error('basemap unavailable'));
        });
      }

      expect(screen.queryByTestId('submission-feature-map-error')).not.toBeInTheDocument();
      expect(screen.getByTestId('submission-feature-map')).toBeInTheDocument();
      // No re-mint either: the tile session is unaffected by the basemap.
      expect(mocks.createSubmissionFeatureTileSession).toHaveBeenCalledTimes(1);
    });

    it('re-requests the session when the user retries', async () => {
      mocks.createSubmissionFeatureTileSession.mockRejectedValueOnce(new Error('nope'));

      renderMap();
      await waitFor(() => expect(screen.getByTestId('submission-feature-map-error')).toBeInTheDocument());

      mocks.createSubmissionFeatureTileSession.mockResolvedValue(buildSession());

      await act(async () => {
        screen.getByRole('button', { name: 'Try again' }).click();
      });

      await waitFor(() => expect(screen.getByTestId('submission-feature-map')).toBeInTheDocument());
      expect(mocks.createSubmissionFeatureTileSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('route changes', () => {
    it('replaces the session and the tile source when another feature is viewed', async () => {
      const { rerender } = await renderReadyMap();

      expect(latestMapProps().tileSources[FEATURE_GEOMETRIES_SOURCE_ID].tiles[0]).toContain('ctx=12%3A34');

      mocks.createSubmissionFeatureTileSession.mockResolvedValue(buildSession({ token: 'token-2' }));

      await act(async () => {
        rerender(<SubmissionFeatureMap submissionId={12} submissionFeatureId={56} />);
      });

      await waitFor(() => expect(mocks.createSubmissionFeatureTileSession).toHaveBeenCalledTimes(2));

      expect(mocks.createSubmissionFeatureTileSession).toHaveBeenLastCalledWith(12, 56, expect.anything());

      await waitFor(() =>
        expect(latestMapProps().tileSources[FEATURE_GEOMETRIES_SOURCE_ID].tiles[0]).toContain('ctx=12%3A56')
      );

      // The map is rebuilt rather than re-aimed, because the initial viewport is set at construction.
      expect(latestMapProps().transformRequest('https://biohub.test/martin/feature/5/5/11')).toEqual({
        url: 'https://biohub.test/martin/feature/5/5/11',
        headers: { Authorization: 'Bearer token-2' }
      });
    });

    it('drops the previous feature’s map while the new session is in flight', async () => {
      const { rerender } = await renderReadyMap();

      mocks.createSubmissionFeatureTileSession.mockReturnValue(new Promise(() => undefined));

      await act(async () => {
        rerender(<SubmissionFeatureMap submissionId={12} submissionFeatureId={56} />);
      });

      // Showing the old feature's geometry under the new feature's heading would be a correctness bug,
      // not just a cosmetic one.
      expect(screen.queryByTestId('submission-feature-map')).not.toBeInTheDocument();
    });
  });
});
