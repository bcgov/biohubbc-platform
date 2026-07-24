import type { ITileSession } from 'interfaces/useTileApi.interface';
import { act, cleanup, render, screen, waitFor } from 'test-helpers/test-utils';
import { SearchResultMapLayout } from './SearchResultMapLayout';
import { SEARCH_RESULTS_SOURCE_ID } from './map-layers';

const mocks = vi.hoisted(() => ({
  createTileSession: vi.fn(),
  setSnackbar: vi.fn(),
  slippyMapProps: [] as Record<string, any>[]
}));

vi.mock('hooks/useApi', () => ({
  useApi: () => ({ tile: { createTileSession: mocks.createTileSession } })
}));

vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setSnackbar: mocks.setSnackbar }),
  useConfigContext: () => ({
    BASEMAP_URL: 'https://basemap.test/{z}/{y}/{x}',
    BASEMAP_ATTRIBUTION: '© Province of British Columbia'
  })
}));

// SlippyMap is exercised by its own suite; here we only care what the search page hands it.
vi.mock('components/map/SlippyMap', () => ({
  SlippyMap: (props: Record<string, any>) => {
    mocks.slippyMapProps.push(props);
    return <div data-testid="slippy-map-stub" />;
  }
}));

const buildSession = (overrides: Partial<ITileSession> = {}): ITileSession => ({
  over_cap: false,
  token: 'token-1',
  token_type: 'Bearer',
  token_expires_in: 900,
  context_expires_in: 1800,
  source: 'search',
  tile_context_id: 'ctx-1',
  tile_url_template: '/tiles/search/{z}/{x}/{y}',
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
    mocks.createTileSession.mockReset();
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
    it('requests a tile session for the current search', async () => {
      mocks.createTileSession.mockResolvedValue(buildSession());

      const expressionTree = { type: 'expression', operator: 'AND', clauses: [] } as any;
      renderLayout({ expressionTree });

      await waitFor(() => expect(mocks.createTileSession).toHaveBeenCalled());

      expect(mocks.createTileSession).toHaveBeenCalledWith(
        'species_observation',
        expressionTree,
        expect.objectContaining({ signal: expect.anything() })
      );
    });

    it('shows a loading state until the session resolves', async () => {
      mocks.createTileSession.mockReturnValue(new Promise(() => undefined));

      renderLayout();

      expect(screen.queryByTestId('search-result-map')).not.toBeInTheDocument();
    });

    it('requests a new session when the search changes', async () => {
      mocks.createTileSession.mockResolvedValue(buildSession());

      const { rerender } = renderLayout();
      await waitFor(() => expect(mocks.createTileSession).toHaveBeenCalledTimes(1));

      const nextExpression = { type: 'expression', operator: 'OR', clauses: [] } as any;

      mocks.createTileSession.mockResolvedValue(buildSession({ tile_context_id: 'ctx-2' }));

      await act(async () => {
        rerender(
          <SearchResultMapLayout
            featureTypeName="species_observation"
            expressionTree={nextExpression}
            onResultClick={vi.fn()}
          />
        );
      });

      await waitFor(() => expect(mocks.createTileSession).toHaveBeenCalledTimes(2));
      expect(mocks.createTileSession).toHaveBeenLastCalledWith(
        'species_observation',
        nextExpression,
        expect.anything()
      );
    });
  });

  describe('tile source', () => {
    it('varies the tile url by context, so a new search does not reuse cached tiles', async () => {
      mocks.createTileSession.mockResolvedValue(buildSession());

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      const source = latestMapProps().tileSources[SEARCH_RESULTS_SOURCE_ID];

      expect(source.tiles[0]).toBe('https://biohub.test/tiles/search/{z}/{x}/{y}?ctx=ctx-1');
    });

    it('never places the token in the tile url', async () => {
      mocks.createTileSession.mockResolvedValue(buildSession({ token: 'super-secret-token' }));

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      const source = latestMapProps().tileSources[SEARCH_RESULTS_SOURCE_ID];

      expect(source.tiles[0]).not.toContain('super-secret-token');
    });
  });

  describe('token transport', () => {
    it('attaches the token as an Authorization header on tile requests only', async () => {
      mocks.createTileSession.mockResolvedValue(buildSession({ token: 'token-abc' }));

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      const { transformRequest } = latestMapProps();

      expect(transformRequest('https://biohub.test/tiles/search/5/5/11')).toEqual({
        url: 'https://biohub.test/tiles/search/5/5/11',
        headers: { Authorization: 'Bearer token-abc' }
      });

      // The basemap is a third party; the tile token must never be sent there.
      expect(transformRequest('https://basemap.test/5/11/5')).toEqual({ url: 'https://basemap.test/5/11/5' });
    });
  });

  describe('feature selection', () => {
    it('navigates to the selected feature', async () => {
      mocks.createTileSession.mockResolvedValue(buildSession());
      const onResultClick = vi.fn();

      renderLayout({ onResultClick });
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      latestMapProps().onFeatureClick([{ properties: { submission_id: 3, submission_feature_id: 42 } }]);

      expect(onResultClick).toHaveBeenCalledWith({ submission_id: 3, submission_feature_id: 42 });
    });

    it('ignores a selection missing its identifiers', async () => {
      mocks.createTileSession.mockResolvedValue(buildSession());
      const onResultClick = vi.fn();

      renderLayout({ onResultClick });
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      latestMapProps().onFeatureClick([{ properties: {} }]);

      expect(onResultClick).not.toHaveBeenCalled();
    });
  });

  describe('states', () => {
    it('explains that a search is too large to map, and renders no tile source', async () => {
      mocks.createTileSession.mockResolvedValue({ over_cap: true, cap: 50000 });

      renderLayout();

      await waitFor(() => expect(screen.getByTestId('search-result-map-over-cap')).toBeInTheDocument());
      expect(screen.getByText(/too many results/i)).toBeInTheDocument();
      expect(screen.queryByTestId('search-result-map')).not.toBeInTheDocument();
    });

    it('shows an empty state when the search matched nothing mappable', async () => {
      mocks.createTileSession.mockResolvedValue(buildSession({ feature_count: 0 }));

      renderLayout();

      await waitFor(() => expect(screen.getByTestId('search-result-map-empty')).toBeInTheDocument());
    });

    it('surfaces a recoverable error when the session cannot be created', async () => {
      mocks.createTileSession.mockRejectedValue(new Error('network down'));

      renderLayout();

      await waitFor(() => expect(screen.getByTestId('search-result-map-error')).toBeInTheDocument());
      expect(mocks.setSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ open: true, snackbarMessage: 'network down' })
      );
    });
  });

  describe('recovery', () => {
    it('requests a new session when the tile source reports a failure', async () => {
      mocks.createTileSession.mockResolvedValue(buildSession());

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());
      expect(mocks.createTileSession).toHaveBeenCalledTimes(1);

      await act(async () => {
        latestMapProps().onSourceError(SEARCH_RESULTS_SOURCE_ID);
      });

      await waitFor(() => expect(mocks.createTileSession).toHaveBeenCalledTimes(2));
    });

    it('ignores failures from the basemap source', async () => {
      mocks.createTileSession.mockResolvedValue(buildSession());

      renderLayout();
      await waitFor(() => expect(screen.getByTestId('search-result-map')).toBeInTheDocument());

      await act(async () => {
        latestMapProps().onSourceError('basemap');
      });

      expect(mocks.createTileSession).toHaveBeenCalledTimes(1);
    });
  });
});
