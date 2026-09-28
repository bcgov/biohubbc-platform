import { FEATURE_GEOMETRIES_SOURCE_ID } from 'components/map/geometry-tile-layers';
import type { ITileExtentSession } from 'interfaces/useMartinApi.interface';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SubmissionUploadReviewMap } from './SubmissionUploadReviewMap';

const mocks = vi.hoisted(() => ({
  mint: vi.fn(),
  extent: vi.fn(),
  mounts: vi.fn(),
  unmounts: vi.fn(),
  fitBounds: vi.fn(),
  easeTo: vi.fn(),
  props: {} as Record<string, any>,
  basemap: { tileSources: {}, layers: [], onViewportChange: vi.fn() }
}));
vi.mock('hooks/useApi', () => {
  const api = {
    martin: { createSubmissionUploadTileSession: mocks.mint },
    admin: { getSubmissionUploadFeatureGeometryExtent: mocks.extent }
  };
  return { useApi: () => api };
});
vi.mock('hooks/useContext', () => ({
  useConfigContext: () => ({ BASEMAP_FALLBACK_STYLE_URL: 'https://style.test/map' })
}));
vi.mock('components/map/useBcBasemap', () => ({ useBcBasemap: () => mocks.basemap }));
vi.mock('components/map/SlippyMap', async () => {
  const { useEffect, useImperativeHandle } = await import('react');
  return {
    SlippyMap: (props: Record<string, any>) => {
      mocks.props = props;
      useImperativeHandle(props.ref, () => ({ fitBounds: mocks.fitBounds, easeTo: mocks.easeTo }));
      useEffect(() => {
        mocks.mounts();
        return () => mocks.unmounts();
      }, []);
      return <div data-testid="map-instance" />;
    }
  };
});
const session = (token = 'token-1'): ITileExtentSession => ({
  has_spatial_properties: true,
  token,
  token_type: 'Bearer',
  token_expires_in: 900,
  source: 'upload',
  source_layer: 'geometries',
  martin_url_template: '/martin/upload/{z}/{x}/{y}',
  bbox: [-125, 48, -120, 52],
  min_zoom: 0,
  max_zoom: 15
});
const source = () => mocks.props.tileSources[FEATURE_GEOMETRIES_SOURCE_ID];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.mint.mockReset();
  mocks.extent.mockReset();
  mocks.mint.mockResolvedValue(session());
  mocks.extent.mockResolvedValue({ bbox: [-125, 48, -120, 52], geometry_count: 1 });
  vi.stubGlobal('location', { origin: 'https://biohub.test' });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('SubmissionUploadReviewMap', () => {
  const view = (id: number | null) => (
    <SubmissionUploadReviewMap submissionId={12} submissionUploadId="upload-1" submissionFeatureId={id} />
  );

  it('shares one upload session and source across selections and retains the mounted map', async () => {
    const { rerender, unmount } = render(view(null));
    const map = screen.getByTestId('map-instance');
    act(() => mocks.props.onMapLoad());
    await waitFor(() => expect(source()).toBeDefined());
    expect(map).toBeVisible();
    expect(mocks.extent).not.toHaveBeenCalled();
    const uploadSource = source();
    rerender(view(34));
    await waitFor(() => expect(mocks.fitBounds).toHaveBeenCalledOnce());
    expect(map).toBeVisible();
    expect(mocks.mint).toHaveBeenCalledExactlyOnceWith(12, 'upload-1', { signal: expect.any(AbortSignal) });
    expect(mocks.extent).toHaveBeenCalledWith(12, 'upload-1', 34, { signal: expect.any(AbortSignal) });
    expect(mocks.props.layers.every((layer: any) => JSON.stringify(layer.specification.filter).includes('34'))).toBe(
      true
    );
    expect(mocks.props.layers.every((layer: any) => layer.specification.filter[1][1][0] === 'geometry-type')).toBe(
      true
    );
    rerender(view(56));
    await waitFor(() => expect(mocks.fitBounds).toHaveBeenCalledTimes(2));
    expect(source()).toBe(uploadSource);
    expect(mocks.props.layers.every((layer: any) => layer.specification.filter[2][2] === 56)).toBe(true);
    expect(mocks.mint).toHaveBeenCalledOnce();
    rerender(view(null));
    expect(map).toBeVisible();
    expect(source()).toBe(uploadSource);
    expect(mocks.mounts).toHaveBeenCalledOnce();
    expect(mocks.unmounts).not.toHaveBeenCalled();
    unmount();
    expect(mocks.unmounts).toHaveBeenCalledOnce();
  });

  it('keeps the basemap visible for an upload without spatial properties', async () => {
    mocks.mint.mockResolvedValue({ has_spatial_properties: false, bbox: null });
    render(view(null));
    act(() => mocks.props.onMapLoad());
    await waitFor(() => expect(mocks.mint).toHaveBeenCalledOnce());
    expect(screen.getByTestId('map-instance')).toBeVisible();
    expect(screen.queryByTestId('submission-upload-review-map-loading')).not.toBeInTheDocument();
    expect(source()).toBeUndefined();
    expect(mocks.extent).not.toHaveBeenCalled();
  });

  it('ignores stale extents and preserves manual zoom for the new selection', async () => {
    let resolve!: (value: unknown) => void;
    mocks.extent.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const { rerender } = render(view(34));
    act(() => mocks.props.onMapLoad());
    expect(screen.queryByTestId('submission-upload-review-map-loading')).not.toBeInTheDocument();
    act(() => mocks.props.onUserZoom());
    rerender(view(56));
    await waitFor(() => expect(mocks.easeTo).toHaveBeenCalledWith({ center: [-122.5, 50] }));
    await act(async () => resolve({ bbox: [0, 0, 1, 1], geometry_count: 1 }));
    expect(mocks.easeTo).toHaveBeenCalledOnce();
    expect(mocks.fitBounds).not.toHaveBeenCalled();
    expect(mocks.extent.mock.calls[0][3].signal.aborted).toBe(true);
    expect(mocks.mint).toHaveBeenCalledOnce();
  });

  it('hides non-spatial features without unmounting and keeps failed extents visible for retry', async () => {
    mocks.extent.mockResolvedValueOnce({ bbox: null, geometry_count: 0 });
    const { rerender } = render(view(34));
    act(() => mocks.props.onMapLoad());
    await waitFor(() => expect(screen.getByTestId('map-instance')).not.toBeVisible());
    expect(mocks.unmounts).not.toHaveBeenCalled();
    expect(mocks.fitBounds).not.toHaveBeenCalled();
    mocks.extent.mockRejectedValueOnce(new Error('failed'));
    rerender(view(56));
    await screen.findByTestId('submission-upload-review-map-error');
    expect(screen.getByTestId('map-instance')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(mocks.fitBounds).toHaveBeenCalledOnce());
    expect(mocks.mint).toHaveBeenCalledOnce();
    expect(mocks.mounts).toHaveBeenCalledOnce();
  });

  it('recovers rejected upload tiles without remounting the map', async () => {
    render(view(34));
    act(() => mocks.props.onMapLoad());
    await waitFor(() => expect(source()).toBeDefined());
    const originalUrl = source().tiles[0];
    let resolve!: (value: ITileExtentSession) => void;
    mocks.mint.mockReturnValueOnce(
      new Promise<ITileExtentSession>((done) => {
        resolve = done;
      })
    );
    vi.useFakeTimers();
    act(() => mocks.props.onSourceError(FEATURE_GEOMETRIES_SOURCE_ID));
    await act(async () => vi.advanceTimersByTime(1000));
    expect(source().tiles[0]).toBe(originalUrl);
    await act(async () => resolve(session('recovered')));
    expect(source().tiles[0]).not.toBe(originalUrl);
    expect(mocks.props.transformRequest('https://biohub.test/martin/upload/1/1/1').headers.Authorization).toBe(
      'Bearer recovered'
    );
    expect(mocks.mounts).toHaveBeenCalledOnce();
    expect(mocks.unmounts).not.toHaveBeenCalled();
  });
});
