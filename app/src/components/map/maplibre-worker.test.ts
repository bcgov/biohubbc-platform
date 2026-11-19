const mocks = vi.hoisted(() => ({ setWorkerUrl: vi.fn() }));

vi.mock('maplibre-gl', () => ({ setWorkerUrl: mocks.setWorkerUrl }));

vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '/assets/maplibre-gl-worker.js' }));

describe('configureMapLibreWorker', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.setWorkerUrl.mockClear();
  });

  it('points MapLibre at the bundled worker', async () => {
    const { configureMapLibreWorker } = await import('./maplibre-worker');

    configureMapLibreWorker();

    expect(mocks.setWorkerUrl).toHaveBeenCalledExactlyOnceWith('/assets/maplibre-gl-worker.js');
  });

  it('sets the worker url once however many maps are created', async () => {
    const { configureMapLibreWorker } = await import('./maplibre-worker');

    configureMapLibreWorker();
    configureMapLibreWorker();
    configureMapLibreWorker();

    expect(mocks.setWorkerUrl).toHaveBeenCalledOnce();
  });
});
