import { configureMapLibreWorker } from './maplibre-worker';

const mocks = vi.hoisted(() => ({ setWorkerUrl: vi.fn() }));

vi.mock('maplibre-gl', () => ({ setWorkerUrl: mocks.setWorkerUrl }));

vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '/assets/maplibre-gl-worker.js' }));

describe('configureMapLibreWorker', () => {
  it('points MapLibre at the bundled worker', () => {
    configureMapLibreWorker();

    expect(mocks.setWorkerUrl).toHaveBeenCalledExactlyOnceWith('/assets/maplibre-gl-worker.js');
  });
});
