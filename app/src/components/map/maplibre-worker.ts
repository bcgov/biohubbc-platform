import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

/**
 * Point MapLibre at the worker bundle Vite emits for it. MapLibre cannot locate its worker from inside a bundle, so
 * this runs before a map is constructed. The setting is global to MapLibre, and setting it again is harmless.
 *
 * @returns {void}
 */
export const configureMapLibreWorker = (): void => {
  setWorkerUrl(maplibreWorkerUrl);
};
