import { BC_BASEMAP_LAYER_ID, BC_BASEMAP_SOURCE_ID } from 'components/map/bc-basemap-layers';
import { FEATURE_GEOMETRIES_SOURCE_ID } from 'components/map/geometry-tile-layers';
import { MAP_FIT_MAX_ZOOM, MAP_SECTION_HEIGHT } from 'constants/spatial';
import type { ISubmissionUploadTileSession } from 'interfaces/useMartinApi.interface';
import { act, cleanup, fireEvent, render, screen, waitFor } from 'test-helpers/test-utils';
import { SubmissionUploadMap } from './SubmissionUploadMap';

const mocks = vi.hoisted(() => ({
  createSubmissionUploadTileSession: vi.fn(),
  slippyMapProps: [] as Record<string, any>[],
  bcBasemap: {
    mode: 'bc',
    tileSources: {
      'bc-basemap': { type: 'raster', tiles: ['bc-basemap://{z}/{x}/{y}?template=x'], tileSize: 256 }
    },
    layers: [
      {
        specification: { id: 'bc-basemap', type: 'raster', source: 'bc-basemap', paint: { 'raster-opacity': 1 } }
      }
    ],
    onViewportChange: vi.fn()
  } as Record<string, any>
}));

vi.mock('hooks/useApi', () => ({
  useApi: () => ({ martin: { createSubmissionUploadTileSession: mocks.createSubmissionUploadTileSession } })
}));

vi.mock('hooks/useContext', () => ({
  useConfigContext: () => ({
    BASEMAP_URL: 'https://basemap.test/tile/{z}/{y}/{x}',
    BASEMAP_ATTRIBUTION: '© Province of British Columbia',
    BASEMAP_FALLBACK_STYLE_URL: 'https://style.test/bright'
  })
}));

vi.mock('components/map/useBcBasemap', () => ({
  useBcBasemap: () => mocks.bcBasemap
}));

// SlippyMap is exercised by its own suite, and the shared session/state machinery by the feature map suite; here we
// only care what the upload map asks for and hands on.
vi.mock('components/map/SlippyMap', () => ({
  SlippyMap: (props: Record<string, any>) => {
    mocks.slippyMapProps.push(props);
    return <div data-testid="slippy-map-stub" />;
  }
}));

const SUBMISSION_ID = 16;
const SUBMISSION_UPLOAD_ID = '11111111-1111-4111-8111-111111111111';

const buildSession = (overrides: Partial<ISubmissionUploadTileSession> = {}): ISubmissionUploadTileSession => ({
  has_spatial_properties: true,
  token: 'token-1',
  token_type: 'Bearer',
  token_expires_in: 900,
  source: 'upload',
  source_layer: 'geometries',
  martin_url_template: '/martin/upload/{z}/{x}/{y}',
  bbox: [-125, 48, -120, 52],
  min_zoom: 0,
  max_zoom: 15,
  ...overrides
});

const renderMap = () =>
  render(<SubmissionUploadMap submissionId={SUBMISSION_ID} submissionUploadId={SUBMISSION_UPLOAD_ID} />);

/** The most recent props SlippyMap was rendered with. */
const latestMapProps = () => mocks.slippyMapProps[mocks.slippyMapProps.length - 1];

const renderReadyMap = async (session = buildSession()) => {
  mocks.createSubmissionUploadTileSession.mockResolvedValue(session);
  const result = renderMap();
  await waitFor(() => expect(screen.getByTestId('submission-upload-map')).toBeInTheDocument());
  return result;
};

describe('SubmissionUploadMap', () => {
  beforeEach(() => {
    mocks.slippyMapProps.length = 0;
    mocks.createSubmissionUploadTileSession.mockReset();
    vi.stubGlobal('location', { origin: 'https://biohub.test' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('tile configuration', () => {
    it('requests a tile session for the upload being reviewed', async () => {
      await renderReadyMap();

      expect(mocks.createSubmissionUploadTileSession).toHaveBeenCalledWith(
        SUBMISSION_ID,
        SUBMISSION_UPLOAD_ID,
        expect.objectContaining({ signal: expect.anything() })
      );
    });

    it('builds the vector source from the returned template, keyed to the upload', async () => {
      await renderReadyMap();

      const source = latestMapProps().tileSources[FEATURE_GEOMETRIES_SOURCE_ID];

      expect(source.type).toBe('vector');
      expect(source.tiles[0]).toBe(
        `https://biohub.test/martin/upload/{z}/{x}/{y}?ctx=${encodeURIComponent(`${SUBMISSION_ID}:${SUBMISSION_UPLOAD_ID}`)}`
      );
      expect(source.minzoom).toBe(0);
      expect(source.maxzoom).toBe(15);
    });

    it('never places the token in the tile url', async () => {
      await renderReadyMap(buildSession({ token: 'super-secret-token' }));

      const source = latestMapProps().tileSources[FEATURE_GEOMETRIES_SOURCE_ID];

      expect(source.tiles[0]).not.toContain('super-secret-token');
    });

    it('attaches the token only to Martin tile requests', async () => {
      await renderReadyMap(buildSession({ token: 'token-abc' }));

      const { transformRequest } = latestMapProps();

      expect(transformRequest('https://biohub.test/martin/upload/5/5/11?ctx=1%3Ax')).toEqual({
        url: 'https://biohub.test/martin/upload/5/5/11?ctx=1%3Ax',
        headers: { Authorization: 'Bearer token-abc' }
      });
      expect(transformRequest('https://style.test/planet/5/5/11.pbf')).toEqual({
        url: 'https://style.test/planet/5/5/11.pbf'
      });
    });

    it('draws the BC basemap beneath the geometry layers', async () => {
      await renderReadyMap();

      const { tileSources, layers } = latestMapProps();

      expect(Object.keys(tileSources)).toEqual([BC_BASEMAP_SOURCE_ID, FEATURE_GEOMETRIES_SOURCE_ID]);
      expect(layers[0].specification.id).toBe(BC_BASEMAP_LAYER_ID);
      expect(layers.slice(1).every((layer: any) => layer.specification.source === FEATURE_GEOMETRIES_SOURCE_ID)).toBe(
        true
      );
      // Points, lines, polygons and their outlines, all against the session's source layer.
      expect(
        layers
          .slice(1)
          .map((layer: any) => layer.specification.type)
          .sort()
      ).toEqual(['circle', 'fill', 'line', 'line']);
      expect(layers.slice(1).every((layer: any) => layer.specification['source-layer'] === 'geometries')).toBe(true);
    });
  });

  describe('viewport', () => {
    it("fits the combined extent of the upload's spatial properties", async () => {
      await renderReadyMap(buildSession({ bbox: [-126.5, 49.25, -121.75, 51.5] }));

      expect(latestMapProps().mapOptions.bounds).toEqual([
        [-126.5, 49.25],
        [-121.75, 51.5]
      ]);
      expect(latestMapProps().mapOptions.fitBoundsOptions.maxZoom).toBe(MAP_FIT_MAX_ZOOM);
    });
  });

  describe('states', () => {
    it('shows a loading state at the section height until the session resolves', () => {
      mocks.createSubmissionUploadTileSession.mockReturnValue(new Promise(() => {}));

      renderMap();

      const frame = screen.getByTestId('submission-upload-map-loading');
      expect(frame).toBeInTheDocument();
      expect(frame).toHaveStyle({ height: `${MAP_SECTION_HEIGHT}px` });
      expect(screen.queryByTestId('submission-upload-map')).not.toBeInTheDocument();
    });

    it('reports an upload with no spatial properties, without initializing a source', async () => {
      mocks.createSubmissionUploadTileSession.mockResolvedValue({ has_spatial_properties: false });

      renderMap();

      await waitFor(() => expect(screen.getByTestId('submission-upload-map-empty')).toBeInTheDocument());
      expect(screen.getByText('This upload has no spatial properties.')).toBeInTheDocument();
      expect(mocks.slippyMapProps).toHaveLength(0);
    });

    it('reports a failure in place with a retry that re-requests the session', async () => {
      mocks.createSubmissionUploadTileSession.mockRejectedValueOnce(new Error('boom'));

      renderMap();

      await waitFor(() => expect(screen.getByTestId('submission-upload-map-error')).toBeInTheDocument());
      expect(screen.getByText('The map could not be loaded.')).toBeInTheDocument();
      expect(mocks.slippyMapProps).toHaveLength(0);

      mocks.createSubmissionUploadTileSession.mockResolvedValueOnce(buildSession());

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      });

      await waitFor(() => expect(screen.getByTestId('submission-upload-map')).toBeInTheDocument());
      expect(mocks.createSubmissionUploadTileSession).toHaveBeenCalledTimes(2);
    });
  });
});
