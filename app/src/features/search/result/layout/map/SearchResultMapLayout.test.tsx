import { MAP_FIT_MAX_ZOOM, MAP_FIT_PADDING, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from 'constants/spatial';
import type { IMartinSession } from 'interfaces/useMartinApi.interface';
import { act, cleanup, render, screen, waitFor } from 'test-helpers/test-utils';
import { SearchResultMapLayout } from './SearchResultMapLayout';
import { SEARCH_RESULTS_SOURCE_ID } from './map-layers';

const mocks = vi.hoisted(() => ({
  createMartinSession: vi.fn(),
  setSnackbar: vi.fn(),
  slippyMapProps: [] as Record<string, any>[],
  // Counts MOUNTS, not renders: a keyed remount is how the layout forces tiles to be re-requested,
  // so the recovery tests assert on when a remount happens, which render counts cannot show.
  slippyMapMounts: { count: 0 }
}));

vi.mock('hooks/useApi', () => ({
  useApi: () => ({ martin: { createMartinSession: mocks.createMartinSession } })
}));

vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setSnackbar: mocks.setSnackbar }),
  useConfigContext: () => ({
    BASEMAP_URL: 'https://basemap.test/{z}/{y}/{x}',
    BASEMAP_ATTRIBUTION: '© Province of British Columbia'
  })
}));

// SlippyMap is exercised by its own suite; here we only care what the search page hands it.
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

const buildSession = (overrides: Partial<IMartinSession> = {}): IMartinSession => ({
  over_cap: false,
  token: 'token-1',
  token_type: 'Bearer',
  token_expires_in: 900,
  context_expires_in: 1800,
  source: 'search',
  martin_context_id: 'ctx-1',
  martin_url_template: '/martin/search/{z}/{x}/{y}',
  bbox: [-125, 48, -120, 52],
  feature_count: 12,
  has_more_secured_features: false,
  ...overrides
});

const renderLayout = (props: Partial<React.ComponentProps<typeof SearchResultMapLayout>> = {}) =>
  render(
    <SearchResultMapLayout
      featureTypeName="species_observation"
      expressionTree={null}
      onResultClick={vi.fn()}
      {...props}
    />
  );

/** The most recent props SlippyMap was rendered with. */
const latestMapProps = () => mocks.slippyMapProps[mocks.slippyMapProps.length - 1];

describe('SearchResultMapLayout', () => {
  beforeEach(() => {
    mocks.slippyMapProps.length = 0;
    mocks.slippyMapMounts.count = 0;
    mocks.createMartinSession.mockReset();
    mocks.setSnackbar.mockReset();
    vi.stubGlobal('location', { origin: 'https://biohub.test' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('session creation', () => {
    it('requests a Martin session for the current search', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      const expressionTree = { type: 'expression', operator: 'AND', clauses: [] } as any;
      renderLayout({ expressionTree });

      await waitFor(() => expect(mocks.createMartinSession).toHaveBeenCalled());

      expect(mocks.createMartinSession).toHaveBeenCalledWith(
        'species_observation',
        expressionTree,
        expect.objectContaining({ signal: expect.anything() })
      );
    });

    it('shows a loading state until the session resolves', async () => {
      mocks.createMartinSession.mockReturnValue(new Promise(() => undefined));

      renderLayout();

      expect(screen.queryByTestId('search-result-map')).not.toBeInTheDocument();
    });

    it('requests a new session when the search changes', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      const { rerender } = renderLayout();
      await waitFor(() => expect(mocks.createMartinSession).toHaveBeenCalledTimes(1));

      const nextExpression = { type: 'expression', operator: 'OR', clauses: [] } as any;

      mocks.createMartinSession.mockResolvedValue(buildSession({ martin_context_id: 'ctx-2' }));

      await act(async () => {
        rerender(
          <SearchResultMapLayout
            featureTypeName="species_observation"
            expressionTree={nextExpression}
            onResultClick={vi.fn()}
          />
        );
      });

      await waitFor(() => expect(mocks.createMartinSession).toHaveBeenCalledTimes(2));
      expect(mocks.createMartinSession).toHaveBeenLastCalledWith(
        'species_observation',
        nextExpression,
        expect.anything()
      );
    });
  });

  describe('viewport', () => {
    it('fits the extent of the search results', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession({ bbox: [-125, 48, -120, 52] }));

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      // Handed to MapLibre as bounds rather than a hand-computed centre and zoom, so the fit
      // accounts for Mercator distortion and the panel's aspect ratio.
      expect(latestMapProps().mapOptions.bounds).toEqual([
        [-125, 48],
        [-120, 52]
      ]);
      expect(latestMapProps().initialCenter).toBeUndefined();
      expect(latestMapProps().initialZoom).toBeUndefined();
    });

    it('falls back to the extent of British Columbia when the search has none', async () => {
      // An unfiltered search is rule-based rather than materialized, so the API returns no bbox.
      mocks.createMartinSession.mockResolvedValue(buildSession({ bbox: null }));

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      const [[west, south], [east, north]] = latestMapProps().mapOptions.bounds;

      // The whole province, not a patch of it: the box has to be wide enough to contain BC.
      expect(east - west).toBeGreaterThan(25);
      expect(north - south).toBeGreaterThan(10);
      expect(west).toBeLessThan(-130);
      expect(east).toBeGreaterThan(-115);
    });

    it('caps how far the initial fit may zoom in, so a single result keeps its surroundings', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession({ bbox: [-125, 48, -125, 48] }));

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      expect(latestMapProps().mapOptions.fitBoundsOptions).toEqual({
        maxZoom: MAP_FIT_MAX_ZOOM,
        padding: MAP_FIT_PADDING
      });
    });

    it('lets the user zoom out far enough to see all of British Columbia', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      expect(latestMapProps().mapOptions.minZoom).toBe(MAP_MIN_ZOOM);
      expect(latestMapProps().mapOptions.maxZoom).toBe(MAP_MAX_ZOOM);
      // BC spans ~42 degrees of longitude, which does not fit above zoom 4.
      expect(MAP_MIN_ZOOM).toBeLessThanOrEqual(4);
    });
  });

  describe('tile source', () => {
    it('varies the tile url by context, so a new search does not reuse cached tiles', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      const source = latestMapProps().tileSources[SEARCH_RESULTS_SOURCE_ID];

      expect(source.tiles[0]).toBe('https://biohub.test/martin/search/{z}/{x}/{y}?ctx=ctx-1');
    });

    it('never places the token in the tile url', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession({ token: 'super-secret-token' }));

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      const source = latestMapProps().tileSources[SEARCH_RESULTS_SOURCE_ID];

      expect(source.tiles[0]).not.toContain('super-secret-token');
    });
  });

  describe('token transport', () => {
    it('attaches the token as an Authorization header on tile requests only', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession({ token: 'token-abc' }));

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      const { transformRequest } = latestMapProps();

      expect(transformRequest('https://biohub.test/martin/search/5/5/11')).toEqual({
        url: 'https://biohub.test/martin/search/5/5/11',
        headers: { Authorization: 'Bearer token-abc' }
      });

      // The basemap is a third party; the tile token must never be sent there.
      expect(transformRequest('https://basemap.test/5/11/5')).toEqual({ url: 'https://basemap.test/5/11/5' });
    });
  });

  describe('feature selection', () => {
    it('navigates to the selected feature', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());
      const onResultClick = vi.fn();

      renderLayout({ onResultClick });
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      latestMapProps().onFeatureClick([{ properties: { submission_id: 3, submission_feature_id: 42 } }]);

      expect(onResultClick).toHaveBeenCalledWith({ submission_id: 3, submission_feature_id: 42 });
    });

    it('ignores a selection missing its identifiers', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());
      const onResultClick = vi.fn();

      renderLayout({ onResultClick });
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      latestMapProps().onFeatureClick([{ properties: {} }]);

      expect(onResultClick).not.toHaveBeenCalled();
    });
  });

  describe('states', () => {
    it('explains that a search is too large to map, and renders no tile source', async () => {
      mocks.createMartinSession.mockResolvedValue({ over_cap: true, cap: 50000 });

      renderLayout();

      await waitFor(() => expect(screen.getByTestId('search-result-map-over-cap')).toBeInTheDocument());
      expect(screen.getByText(/too many results/i)).toBeInTheDocument();
      expect(screen.queryByTestId('search-result-map')).not.toBeInTheDocument();
    });

    it('shows an empty state when the search matched nothing mappable', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession({ feature_count: 0 }));

      renderLayout();

      await waitFor(() => expect(screen.getByTestId('search-result-map-empty')).toBeInTheDocument());
    });

    it('surfaces a recoverable error when the session cannot be created', async () => {
      mocks.createMartinSession.mockRejectedValue(new Error('network down'));

      renderLayout();

      await waitFor(() => expect(screen.getByTestId('search-result-map-error')).toBeInTheDocument());
      expect(mocks.setSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ open: true, snackbarMessage: 'network down' })
      );
    });
  });

  describe('recovery', () => {
    it('requests a new session when the tile source reports a failure', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(1);

      await act(async () => {
        latestMapProps().onSourceError(SEARCH_RESULTS_SOURCE_ID);
      });

      await waitFor(() => expect(mocks.createMartinSession).toHaveBeenCalledTimes(2));
    });

    it('holds the map remount until the recovery token has arrived', async () => {
      // The race this pins down: tiles fail (expired token), and remounting the map BEFORE the
      // re-mint resolves would fire a fresh round of tile requests carrying the same dead token -
      // requests MapLibre never retries, leaving a silently blank map.
      mocks.createMartinSession.mockResolvedValueOnce(buildSession({ token: 'token-1' }));

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      let resolveMint: (session: IMartinSession) => void = () => undefined;
      mocks.createMartinSession.mockImplementationOnce(
        () => new Promise((resolve) => (resolveMint = resolve as (session: IMartinSession) => void))
      );

      const mountsBeforeFailure = mocks.slippyMapMounts.count;

      await act(async () => {
        latestMapProps().onSourceError(SEARCH_RESULTS_SOURCE_ID);
      });

      // The remount has NOT happened while the re-mint is pending: a remounted map would request
      // its tiles with the old token still in the ref. Further failures from the same burst are
      // absorbed without extra mints.
      expect(mocks.slippyMapMounts.count).toBe(mountsBeforeFailure);
      expect(latestMapProps().transformRequest('https://biohub.test/martin/search/5/5/11')).toEqual({
        url: 'https://biohub.test/martin/search/5/5/11',
        headers: { Authorization: 'Bearer token-1' }
      });

      await act(async () => {
        latestMapProps().onSourceError(SEARCH_RESULTS_SOURCE_ID);
      });

      expect(mocks.slippyMapMounts.count).toBe(mountsBeforeFailure);
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveMint(buildSession({ token: 'token-2' }));
      });

      // Only after the new token is in the ref does the map remount and re-request its tiles.
      await waitFor(() => expect(mocks.slippyMapMounts.count).toBe(mountsBeforeFailure + 1));
      expect(latestMapProps().transformRequest('https://biohub.test/martin/search/5/5/11')).toEqual({
        url: 'https://biohub.test/martin/search/5/5/11',
        headers: { Authorization: 'Bearer token-2' }
      });
    });

    it('ignores failures from the basemap source', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      await act(async () => {
        latestMapProps().onSourceError('basemap');
      });

      expect(mocks.createMartinSession).toHaveBeenCalledTimes(1);
    });

    it('re-requests the session when the user retries from the error state', async () => {
      mocks.createMartinSession.mockRejectedValueOnce(new Error('network down'));
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map-error')).toBeInTheDocument());
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(1);

      await act(async () => {
        screen.getByRole('button', { name: /try again/i }).click();
      });

      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(2);
    });

    it('retries through the loading state, never a map holding a dead token', async () => {
      // Reaching the error state drops the session. Without that, retry would render the map
      // immediately - firing every tile request with no usable token - instead of the skeleton.
      mocks.createMartinSession.mockResolvedValueOnce(buildSession({ token: 'token-1' }));

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      // Spend the recovery budget (each re-mint succeeds, but tiles keep failing)...
      for (let failure = 0; failure < 3; failure++) {
        await act(async () => latestMapProps().onSourceError(SEARCH_RESULTS_SOURCE_ID));
      }

      // ...giving up removes the map entirely; there is no stale session left to render.
      await waitFor(() => expect(screen.getByTestId('search-result-map-error')).toBeInTheDocument());
      expect(screen.queryByTestId('search-result-map')).not.toBeInTheDocument();

      mocks.createMartinSession.mockImplementationOnce(() => new Promise(() => undefined));

      await act(async () => {
        screen.getByRole('button', { name: /try again/i }).click();
      });

      // The retry mint is pending: the layout shows the loading skeleton, not a token-less map.
      expect(screen.queryByTestId('search-result-map')).not.toBeInTheDocument();
      expect(screen.queryByTestId('search-result-map-error')).not.toBeInTheDocument();
    });

    it('gives up re-minting after the recovery budget is spent, instead of looping', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(1);

      // The first two tile failures each re-mint to recover a possibly-expired token...
      await act(async () => latestMapProps().onSourceError(SEARCH_RESULTS_SOURCE_ID));
      await waitFor(() => expect(mocks.createMartinSession).toHaveBeenCalledTimes(2));

      await act(async () => latestMapProps().onSourceError(SEARCH_RESULTS_SOURCE_ID));
      await waitFor(() => expect(mocks.createMartinSession).toHaveBeenCalledTimes(3));

      // ...the third gives up and surfaces the error rather than re-minting forever.
      await act(async () => latestMapProps().onSourceError(SEARCH_RESULTS_SOURCE_ID));
      await waitFor(() => expect(screen.getByTestId('search-result-map-error')).toBeInTheDocument());
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(3);
    });
  });

  describe('search changes', () => {
    it('shows the loading state while the new search mints, not the previous search results', async () => {
      mocks.createMartinSession.mockResolvedValueOnce(buildSession());

      const { rerender } = renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      // Materializing a filtered context can take seconds; the mint never resolves in this test.
      mocks.createMartinSession.mockImplementationOnce(() => new Promise(() => undefined));

      const nextExpression = { type: 'expression', operator: 'AND', clauses: [] } as any;

      await act(async () => {
        rerender(
          <SearchResultMapLayout
            featureTypeName="species_observation"
            expressionTree={nextExpression}
            onResultClick={vi.fn()}
          />
        );
      });

      // Rendering the old search's geometry here would be wrong data, not just a stale spinner:
      // its features are clickable and navigate.
      expect(screen.queryByTestId('search-result-map')).not.toBeInTheDocument();
    });
  });
});
