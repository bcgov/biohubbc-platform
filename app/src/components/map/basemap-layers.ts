import type { SourceSpecification } from 'maplibre-gl';
import type { ISlippyMapLayer } from './SlippyMap.interface';

export const BASEMAP_SOURCE_ID = 'basemap';
export const BASEMAP_LAYER_ID = 'basemap';

/**
 * Build the raster basemap source.
 *
 * The basemap is served by an external provider, so it is its own source rather than part of any source carrying
 * BioHub data: it renders underneath them, and a provider outage costs the map its backdrop and nothing else.
 *
 * @param {string} basemapUrl - Tile URL template from app config.
 * @param {string} attribution - Attribution text required by the basemap provider.
 * @return {*}  {SourceSpecification}
 */
export const buildBasemapSource = (basemapUrl: string, attribution: string): SourceSpecification => ({
  type: 'raster',
  tiles: [basemapUrl],
  tileSize: 256,
  attribution
});

/**
 * Build the basemap layer. Added before any data layer, so it renders underneath.
 *
 * @return {*}  {ISlippyMapLayer}
 */
export const buildBasemapLayer = (): ISlippyMapLayer => ({
  specification: {
    id: BASEMAP_LAYER_ID,
    type: 'raster',
    source: BASEMAP_SOURCE_ID
  }
});
