import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';

export const BASEMAP_SOURCE_ID = 'basemap';
export const BASEMAP_LAYER_ID = 'basemap';

/**
 * Build the raster basemap source.
 *
 * The basemap is a third party service, so it is kept separate from any source carrying BioHub data: nothing that
 * authorizes a BioHub tile request may ever be attached to a request for these tiles.
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
 * @return {*}  {LayerSpecification}
 */
export const buildBasemapLayer = (): LayerSpecification => ({
  id: BASEMAP_LAYER_ID,
  type: 'raster',
  source: BASEMAP_SOURCE_ID
});
