import {
  BC_BASEMAP_COVERAGE_BBOX,
  BC_BASEMAP_MAX_ZOOM,
  BC_BASEMAP_MIN_ZOOM,
  BC_BASEMAP_TILE_SIZE
} from 'constants/basemap';
import type { SourceSpecification } from 'maplibre-gl';
import { buildBcBasemapTileUrlTemplate, registerBcBasemapProtocol } from './bc-basemap-protocol';
import type { ISlippyMapLayer } from './SlippyMap.interface';

export const BC_BASEMAP_SOURCE_ID = 'bc-basemap';
export const BC_BASEMAP_LAYER_ID = 'bc-basemap';

/**
 * Which basemap the map is showing: the BC Government one, or the worldwide style beneath it.
 */
export type BcBasemapMode = 'bc' | 'fallback';

/**
 * Build the BC Government basemap source.
 *
 * Its tiles go through the `bc-basemap://` protocol so each can be read before it is drawn; the handler is registered
 * here so the template can never reach a map without it. The source declares the service's extent and zoom range,
 * so MapLibre asks for nothing the service cannot hold.
 *
 * @param {string} basemapUrl - The provider's tile URL template, from app config.
 * @param {string} attribution - Attribution text required by the provider's terms.
 * @return {*}  {SourceSpecification}
 */
export const buildBcBasemapSource = (basemapUrl: string, attribution: string): SourceSpecification => {
  registerBcBasemapProtocol();

  return {
    type: 'raster',
    tiles: [buildBcBasemapTileUrlTemplate(basemapUrl)],
    tileSize: BC_BASEMAP_TILE_SIZE,
    minzoom: BC_BASEMAP_MIN_ZOOM,
    maxzoom: BC_BASEMAP_MAX_ZOOM,
    bounds: BC_BASEMAP_COVERAGE_BBOX,
    attribution
  };
};

/**
 * Build the BC Government basemap layer. Added before any data layer, so it renders beneath them and above the map
 * style.
 *
 * The mode is carried as the layer's opacity rather than its visibility: MapLibre stops requesting tiles for a layer
 * it does not draw, and the tiles are what decide when the map can switch back. At opacity 0 the tiles keep arriving
 * and nothing is painted.
 *
 * @param {BcBasemapMode} mode
 * @return {*}  {ISlippyMapLayer}
 */
export const buildBcBasemapLayer = (mode: BcBasemapMode): ISlippyMapLayer => ({
  specification: {
    id: BC_BASEMAP_LAYER_ID,
    type: 'raster',
    source: BC_BASEMAP_SOURCE_ID,
    paint: { 'raster-opacity': mode === 'bc' ? 1 : 0 }
  }
});
