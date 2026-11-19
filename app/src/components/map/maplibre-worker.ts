import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

let isConfigured = false;

/**
 * Point MapLibre at the worker bundle Vite emits for it. MapLibre cannot locate its worker from inside a bundle, so
 * this runs before the first map is constructed. The setting is global to MapLibre and needed once per page, so
 * repeated calls are harmless.
 */
export const configureMapLibreWorker = (): void => {
  if (isConfigured) {
    return;
  }

  setWorkerUrl(maplibreWorkerUrl);
  isConfigured = true;
};
