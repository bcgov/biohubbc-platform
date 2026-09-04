import { MAP_FIT_MAX_ZOOM, MAP_FIT_PADDING, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from 'constants/spatial';
import type { IMartinSession } from 'interfaces/useMartinApi.interface';
import { act, cleanup, render, screen, waitFor } from 'test-helpers/test-utils';
import { SearchResultMapContainer } from './SearchResultMapContainer';
import { SEARCH_RESULTS_SOURCE_ID } from './map-layers';

const mocks = vi.hoisted(() => ({
  createMartinSession: vi.fn(),
  setSnackbar: vi.fn(),
  slippyMapProps: [] as Record<string, any>[],
  // Counts MOUNTS, not renders: a keyed remount is how the container forces tiles to be re-requested,
  // so the recovery tests assert on when a remount happens, which render counts cannot show.
  slippyMapMounts: { count: 0 },
  easeTo: vi.fn(),
  getZoom: vi.fn(() => 7)
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

// SlippyMap is exercised by its own suite; here we only care what the search page hands it. The stub stands in for
// the real component's popup ownership: it renders whatever the clicked layer's `popupRender` returns and supplies
// the same camera helpers, so the container's popper content and its zoom-in action can be asserted.
vi.mock('components/map/SlippyMap', async () => {
  const { useEffect, useState } = await import('react');

  return {
    SlippyMap: (props: Record<string, any>) => {
      const [popup, setPopup] = useState<{ layerId: string; feature: any } | null>(null);

      mocks.slippyMapProps.push({ ...props, openPopup: setPopup, closePopup: () => setPopup(null) });
      useEffect(() => {
        mocks.slippyMapMounts.count += 1;
      }, []);

      const layer = popup ? props.layers?.find((entry: any) => entry.specification.id === popup.layerId) : undefined;

      return (
        <div data-testid="slippy-map-stub">
          {layer?.popupRender?.({
            feature: popup?.feature,
            lngLat: { lng: -124, lat: 54 },
            close: () => setPopup(null),
            easeTo: mocks.easeTo,
            getZoom: mocks.getZoom
          })}
        </div>
      );
    }
  };
});

const buildSession = (overrides: Partial<IMartinSession> = {}): IMartinSession => ({
  token: 'token-1',
  token_type: 'Bearer',
  token_expires_in: 900,
  context_expires_in: 1800,
  source: 'search',
  martin_context_id: 'ctx-1',
  martin_url_template: '/martin/search/{z}/{x}/{y}',
  has_more_secured_features: false,
  ...overrides
});

const renderContainer = (props: Partial<React.ComponentProps<typeof SearchResultMapContainer>> = {}) =>
  render(<SearchResultMapContainer featureTypeName="species_observation" expressionTree={null} isActive {...props} />);

/** The most recent props SlippyMap was rendered with. */
const latestMapProps = () => mocks.slippyMapProps[mocks.slippyMapProps.length - 1];

/** Report one failed tile request, then advance past the recovery backoff so the re-mint fires. */
const failTilesAndAwaitRecovery = async (backoffMs: number) => {
  await act(async () => {
    latestMapProps().onSourceError(SEARCH_RESULTS_SOURCE_ID);
  });
  await act(async () => {
    vi.advanceTimersByTime(backoffMs);
  });
};

describe('SearchResultMapContainer', () => {
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
      renderContainer({ expressionTree });

      await waitFor(() => expect(mocks.createMartinSession).toHaveBeenCalled());

      expect(mocks.createMartinSession).toHaveBeenCalledWith(
        'species_observation',
        expressionTree,
        expect.objectContaining({ signal: expect.anything() })
      );
    });

    it('passes the submission scope when requesting a Martin session', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderContainer({ submissionIds: [42] });

      await waitFor(() => expect(mocks.createMartinSession).toHaveBeenCalled());
      expect(mocks.createMartinSession).toHaveBeenCalledWith(
        'species_observation',
        null,
        expect.objectContaining({ submissionIds: [42], signal: expect.anything() })
      );
    });

    it('shows a loading state until the session resolves', async () => {
      mocks.createMartinSession.mockReturnValue(new Promise(() => undefined));

      renderContainer();

      expect(screen.getByTestId('search-result-map-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('search-result-map')).not.toBeInTheDocument();
    });

    it('requests a new session when the search changes', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      const { rerender } = renderContainer();
      await waitFor(() => expect(mocks.createMartinSession).toHaveBeenCalledTimes(1));

      const nextExpression = { type: 'expression', operator: 'OR', clauses: [] } as any;

      mocks.createMartinSession.mockResolvedValue(buildSession({ martin_context_id: 'ctx-2' }));

      await act(async () => {
        rerender(
          <SearchResultMapContainer featureTypeName="species_observation" expressionTree={nextExpression} isActive />
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
    it('opens on the extent of British Columbia', async () => {
      // A session carries no extent of its own: nothing about the result set is materialized, so
      // the map always frames the whole province.
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      const [[west, south], [east, north]] = latestMapProps().mapOptions.bounds;

      // The whole province, not a patch of it: the box has to be wide enough to contain BC.
      expect(east - west).toBeGreaterThan(25);
      expect(north - south).toBeGreaterThan(10);
      expect(west).toBeLessThan(-130);
      expect(east).toBeGreaterThan(-115);
      expect(latestMapProps().initialCenter).toBeUndefined();
      expect(latestMapProps().initialZoom).toBeUndefined();
    });

    it('caps how far the initial fit may zoom in', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      expect(latestMapProps().mapOptions.fitBoundsOptions).toEqual({
        maxZoom: MAP_FIT_MAX_ZOOM,
        padding: MAP_FIT_PADDING
      });
    });

    it('lets the user zoom out far enough to see all of British Columbia', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderContainer();
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

      renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      const source = latestMapProps().tileSources[SEARCH_RESULTS_SOURCE_ID];

      expect(source.tiles[0]).toBe('https://biohub.test/martin/search/{z}/{x}/{y}?ctx=ctx-1');
    });

    it('never places the token in the tile url', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession({ token: 'super-secret-token' }));

      renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      const source = latestMapProps().tileSources[SEARCH_RESULTS_SOURCE_ID];

      expect(source.tiles[0]).not.toContain('super-secret-token');
    });
  });

  describe('token transport', () => {
    it('attaches the token as an Authorization header once a session exists', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession({ token: 'token-abc' }));

      renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      const { transformRequest } = latestMapProps();

      expect(transformRequest('https://biohub.test/martin/search/5/5/11')).toEqual({
        url: 'https://biohub.test/martin/search/5/5/11',
        headers: { Authorization: 'Bearer token-abc' }
      });

      expect(transformRequest('https://basemap.test/5/11/5')).toEqual({
        url: 'https://basemap.test/5/11/5',
        headers: { Authorization: 'Bearer token-abc' }
      });
    });
  });

  describe('hidden map view', () => {
    /** Render the map, then switch to the table view, which keeps this component mounted but inactive. */
    const renderThenHide = async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());
      const { rerender } = renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      await act(async () => {
        rerender(
          <SearchResultMapContainer featureTypeName="species_observation" expressionTree={null} isActive={false} />
        );
      });

      return { rerender };
    };

    it('holds its session while hidden, so returning to it does not rebuild the map', async () => {
      const { rerender } = await renderThenHide();
      const mountsWhileHidden = mocks.slippyMapMounts.count;

      // Still the map, not the loading state: dropping the session here is what would rebuild it on the way back.
      expect(screen.getByTestId('search-result-map')).toBeInTheDocument();

      await act(async () => {
        rerender(<SearchResultMapContainer featureTypeName="species_observation" expressionTree={null} isActive />);
      });

      expect(mocks.slippyMapMounts.count).toBe(mountsWhileHidden);
    });

    it('makes no requests while hidden, and re-mints on the way back', async () => {
      // Fake timers from the start, so the refresh scheduled on the first mint is one this test controls.
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const { rerender } = await renderThenHide();
      const mintsWhileHidden = mocks.createMartinSession.mock.calls.length;

      // Well past the token refresh lead time: a hidden map talks to nobody.
      await act(async () => {
        vi.advanceTimersByTime(60 * 60 * 1000);
      });

      expect(mocks.createMartinSession.mock.calls.length).toBe(mintsWhileHidden);

      await act(async () => {
        rerender(<SearchResultMapContainer featureTypeName="species_observation" expressionTree={null} isActive />);
      });

      // The token it was holding may have expired while hidden, so coming back rotates it.
      expect(mocks.createMartinSession.mock.calls.length).toBe(mintsWhileHidden + 1);
    });
  });

  describe('cluster interaction', () => {
    /** A decoded tile cluster, as the map's hit test returns it. */
    const tileCluster = (properties: Record<string, unknown> = {}) => ({
      source: 'search-results',
      sourceLayer: 'clusters',
      layer: { id: 'search-clusters' },
      properties: { location_count: 482391, ...properties }
    });

    const renderReadyMap = async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());
      renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());
    };

    /** The popup renderer the container declared on a layer, or undefined where the layer is display-only. */
    const layerPopupRender = (layerId: string) =>
      latestMapProps().layers.find((layer: { specification: { id: string } }) => layer.specification.id === layerId)
        ?.popupRender;

    /** Click a cluster, as the map does when its hit test lands on the cluster layer. */
    const clickCluster = (cluster: Record<string, unknown>) =>
      act(() => latestMapProps().openPopup({ layerId: 'search-clusters', feature: cluster }));

    it('opens the cluster popper with the represented location count and a Zoom in action', async () => {
      await renderReadyMap();
      const mintCallsBefore = mocks.createMartinSession.mock.calls.length;

      clickCluster(tileCluster());

      expect(screen.getByTestId('search-result-map-popper-count')).toHaveTextContent('482,391 locations');
      expect(screen.getByRole('button', { name: 'Zoom in' })).toHaveClass('MuiButton-contained');
      // Selecting a cluster requests nothing: everything shown comes from the decoded tile.
      expect(mocks.createMartinSession.mock.calls.length).toBe(mintCallsBefore);
    });

    it('zooms into the selected cluster by the configured increment and closes the popper', async () => {
      await renderReadyMap();
      mocks.getZoom.mockReturnValue(7);

      clickCluster(tileCluster());
      act(() => screen.getByRole('button', { name: 'Zoom in' }).click());

      expect(mocks.easeTo).toHaveBeenCalledWith({ center: [-124, 54], zoom: 9 });
      expect(screen.queryByTestId('search-result-map-popper')).not.toBeInTheDocument();
    });

    it('never zooms past the configured maximum', async () => {
      await renderReadyMap();
      mocks.getZoom.mockReturnValue(14);

      clickCluster(tileCluster());
      act(() => screen.getByRole('button', { name: 'Zoom in' }).click());

      expect(mocks.easeTo).toHaveBeenCalledWith({ center: [-124, 54], zoom: 15 });
    });

    it('leaves the raw geometry layers display-only, since they carry nothing to resolve', async () => {
      await renderReadyMap();

      // Feature tiles are geometry only, so those layers declare nothing interactive at all: they take no part in
      // the map's hit test, and there is deliberately no feature popper.
      for (const layerId of ['search-points', 'search-lines', 'search-fills', 'search-outlines']) {
        expect(layerPopupRender(layerId)).toBeUndefined();
        expect(
          latestMapProps().layers.find((layer: { specification: { id: string } }) => layer.specification.id === layerId)
            ?.onClick
        ).toBeUndefined();
      }
    });

    it('replaces the active selection instead of stacking poppers', async () => {
      await renderReadyMap();

      clickCluster(tileCluster({ location_count: 10 }));
      clickCluster(tileCluster({ location_count: 20 }));

      expect(screen.getAllByTestId('search-result-map-popper')).toHaveLength(1);
      expect(screen.getByTestId('search-result-map-popper-count')).toHaveTextContent('20 locations');
    });

    it('closes the popper from its explicit dismiss control', async () => {
      await renderReadyMap();

      clickCluster(tileCluster());
      act(() => screen.getByTestId('search-result-map-popper-close').click());

      expect(screen.queryByTestId('search-result-map-popper')).not.toBeInTheDocument();
    });

    it('names a single location in the singular', async () => {
      await renderReadyMap();

      clickCluster(tileCluster({ location_count: 1 }));

      expect(screen.getByTestId('search-result-map-popper-count')).toHaveTextContent('1 location');
    });

    it('ignores a cluster missing its count', async () => {
      await renderReadyMap();

      clickCluster(tileCluster({ location_count: undefined }));

      expect(screen.queryByTestId('search-result-map-popper')).not.toBeInTheDocument();
    });
  });

  describe('states', () => {
    it('surfaces a recoverable error when the session cannot be created', async () => {
      mocks.createMartinSession.mockRejectedValue(new Error('network down'));

      renderContainer();

      await waitFor(() => expect(screen.getByTestId('search-result-map-error')).toBeInTheDocument());
      expect(mocks.setSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ open: true, snackbarMessage: 'network down' })
      );
    });
  });

  describe('recovery', () => {
    it('waits out an exponential backoff before each automatic re-mint', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(1);

      vi.useFakeTimers();

      // First failure: the re-mint is scheduled, not fired — the service gets breathing room
      // instead of an immediate burst of consecutive mints.
      await act(async () => {
        latestMapProps().onSourceError(SEARCH_RESULTS_SOURCE_ID);
      });
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(999);
      });
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(2);

      // Second failure: the delay doubles.
      await act(async () => {
        latestMapProps().onSourceError(SEARCH_RESULTS_SOURCE_ID);
      });
      await act(async () => {
        vi.advanceTimersByTime(1999);
      });
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(2);

      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(3);
    });

    it('holds the map remount until the recovery token has arrived', async () => {
      // The race this pins down: tiles fail (expired token), and remounting the map BEFORE the
      // re-mint resolves would fire a fresh round of tile requests carrying the same dead token -
      // requests MapLibre never retries, leaving a silently blank map.
      mocks.createMartinSession.mockResolvedValueOnce(buildSession({ token: 'token-1' }));

      renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      let resolveMint: (session: IMartinSession) => void = () => undefined;
      mocks.createMartinSession.mockImplementationOnce(
        () => new Promise((resolve) => (resolveMint = resolve as (session: IMartinSession) => void))
      );

      const mountsBeforeFailure = mocks.slippyMapMounts.count;

      vi.useFakeTimers();

      await failTilesAndAwaitRecovery(1000);

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
      expect(mocks.slippyMapMounts.count).toBe(mountsBeforeFailure + 1);
      expect(latestMapProps().transformRequest('https://biohub.test/martin/search/5/5/11')).toEqual({
        url: 'https://biohub.test/martin/search/5/5/11',
        headers: { Authorization: 'Bearer token-2' }
      });
    });

    it('ignores failures from the basemap source', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      await act(async () => {
        latestMapProps().onSourceError('basemap');
      });

      expect(mocks.createMartinSession).toHaveBeenCalledTimes(1);
    });

    it('re-requests the session immediately when the user retries from the error state', async () => {
      mocks.createMartinSession.mockRejectedValueOnce(new Error('network down'));
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderContainer();
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

      renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      vi.useFakeTimers();

      // Spend the recovery budget (each re-mint succeeds, but tiles keep failing)...
      await failTilesAndAwaitRecovery(1000);
      await failTilesAndAwaitRecovery(2000);
      await act(async () => {
        latestMapProps().onSourceError(SEARCH_RESULTS_SOURCE_ID);
      });

      // ...giving up removes the map entirely; there is no stale session left to render.
      expect(screen.getByTestId('search-result-map-error')).toBeInTheDocument();
      expect(screen.queryByTestId('search-result-map')).not.toBeInTheDocument();

      mocks.createMartinSession.mockImplementationOnce(() => new Promise(() => undefined));

      await act(async () => {
        screen.getByRole('button', { name: /try again/i }).click();
      });

      // The retry mint is pending: the layout shows the loading skeleton, not a token-less map.
      expect(screen.getByTestId('search-result-map-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('search-result-map')).not.toBeInTheDocument();
      expect(screen.queryByTestId('search-result-map-error')).not.toBeInTheDocument();
    });

    it('gives up re-minting after the recovery budget is spent, instead of looping', async () => {
      mocks.createMartinSession.mockResolvedValue(buildSession());

      renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(1);

      vi.useFakeTimers();

      // The first two tile failures each re-mint to recover a possibly-expired token...
      await failTilesAndAwaitRecovery(1000);
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(2);

      await failTilesAndAwaitRecovery(2000);
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(3);

      // ...the third gives up and surfaces the error rather than re-minting forever.
      await act(async () => {
        latestMapProps().onSourceError(SEARCH_RESULTS_SOURCE_ID);
      });
      await act(async () => {
        vi.advanceTimersByTime(60000);
      });
      expect(screen.getByTestId('search-result-map-error')).toBeInTheDocument();
      expect(mocks.createMartinSession).toHaveBeenCalledTimes(3);
    });

    it('does not stack a snackbar per failed automatic recovery', async () => {
      mocks.createMartinSession.mockResolvedValueOnce(buildSession());

      renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      vi.useFakeTimers();

      // The recovery mint itself fails; the error state (with its "Try again") is the surface for
      // that, not a snackbar per attempt.
      mocks.createMartinSession.mockRejectedValueOnce(new Error('still down'));
      await failTilesAndAwaitRecovery(1000);

      expect(screen.getByTestId('search-result-map-error')).toBeInTheDocument();
      expect(mocks.setSnackbar).not.toHaveBeenCalled();
    });
  });

  describe('search changes', () => {
    it('shows the loading state while the new search mints, not the previous search results', async () => {
      mocks.createMartinSession.mockResolvedValueOnce(buildSession());

      const { rerender } = renderContainer();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      // The new session's mint never resolves in this test.
      mocks.createMartinSession.mockImplementationOnce(() => new Promise(() => undefined));

      const nextExpression = { type: 'expression', operator: 'AND', clauses: [] } as any;

      await act(async () => {
        rerender(
          <SearchResultMapContainer featureTypeName="species_observation" expressionTree={nextExpression} isActive />
        );
      });

      // Rendering the old search's geometry here would be wrong data, not just a stale spinner.
      expect(screen.getByTestId('search-result-map-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('search-result-map')).not.toBeInTheDocument();
    });
  });
});
