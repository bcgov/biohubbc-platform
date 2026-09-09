import {
  BC_BASEMAP_BLANK_TILE_RGB,
  BC_BASEMAP_BLANK_TILE_TOLERANCE,
  BC_BASEMAP_SAMPLE_STEP,
  BC_BASEMAP_TILE_SIZE
} from 'constants/basemap';
import { addProtocol, type AddProtocolAction } from 'maplibre-gl';
import { bcTileKey, recordBcTileClassification } from './bc-basemap-registry';

/** URL scheme MapLibre hands to {@link loadBcBasemapTile} instead of fetching itself. */
export const BC_BASEMAP_PROTOCOL = 'bc-basemap';

const TILE_URL_PATTERN = new RegExp(`^${BC_BASEMAP_PROTOCOL}://(\\d+)/(\\d+)/(\\d+)\\?template=([^&]+)$`);

interface ITileCoordinates {
  z: number;
  x: number;
  y: number;
}

/**
 * Build the tile URL template the BC basemap source is given.
 *
 * MapLibre substitutes only the literal `{z}`, `{x}` and `{y}` it finds, so the provider's own template travels
 * percent-encoded in the query, braces included, and is substituted by the handler instead. That keeps the
 * provider's placeholder order (ArcGIS caches use `{z}/{y}/{x}`) out of the scheme entirely.
 *
 * @param {string} providerTemplate - The provider's tile URL template.
 * @return {*}  {string}
 */
export const buildBcBasemapTileUrlTemplate = (providerTemplate: string): string =>
  `${BC_BASEMAP_PROTOCOL}://{z}/{x}/{y}?template=${encodeURIComponent(providerTemplate)}`;

/**
 * Read the tile and the provider template back out of a URL built by {@link buildBcBasemapTileUrlTemplate}.
 *
 * @param {string} url
 * @return {*}  {{ tile: ITileCoordinates; template: string }}
 */
export const parseBcBasemapTileUrl = (url: string): { tile: ITileCoordinates; template: string } => {
  const match = TILE_URL_PATTERN.exec(url);

  if (!match) {
    throw new Error(`Not a ${BC_BASEMAP_PROTOCOL} tile url: ${url}`);
  }

  return {
    tile: { z: Number(match[1]), x: Number(match[2]), y: Number(match[3]) },
    template: decodeURIComponent(match[4])
  };
};

/**
 * The provider's URL for a tile: each placeholder is substituted by name, whatever order the template puts them in.
 *
 * @param {string} template - The provider's tile URL template.
 * @param {ITileCoordinates} tile
 * @return {*}  {string}
 */
export const buildProviderTileUrl = (template: string, tile: ITileCoordinates): string =>
  template.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));

/**
 * Whether decoded tile pixels are the service's blank tile: uniformly its grey, within JPEG tolerance.
 *
 * Sampled on a grid rather than read in full: a blank tile is uniform everywhere, and a tile with any content is
 * caught as soon as one sample differs.
 *
 * @param {Uint8ClampedArray} data - RGBA pixels, row-major.
 * @param {number} width
 * @param {number} height
 * @return {*}  {boolean}
 */
export const isSolidGrey = (data: Uint8ClampedArray, width: number, height: number): boolean => {
  if (!width || !height || data.length < width * height * 4) {
    return false;
  }

  const [red, green, blue] = BC_BASEMAP_BLANK_TILE_RGB;

  for (let y = 0; y < height; y += BC_BASEMAP_SAMPLE_STEP) {
    for (let x = 0; x < width; x += BC_BASEMAP_SAMPLE_STEP) {
      const offset = (y * width + x) * 4;

      if (
        Math.abs(data[offset] - red) > BC_BASEMAP_BLANK_TILE_TOLERANCE ||
        Math.abs(data[offset + 1] - green) > BC_BASEMAP_BLANK_TILE_TOLERANCE ||
        Math.abs(data[offset + 2] - blue) > BC_BASEMAP_BLANK_TILE_TOLERANCE
      ) {
        return false;
      }
    }
  }

  return true;
};

let canvasContext: CanvasRenderingContext2D | null | undefined;

/**
 * One reusable 2D context for reading tile pixels. Created lazily, since a map is not on every page.
 *
 * @return {*}  {(CanvasRenderingContext2D | null)} Null where the browser offers no 2D context.
 */
const getCanvasContext = (): CanvasRenderingContext2D | null => {
  if (canvasContext === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = BC_BASEMAP_TILE_SIZE;
    canvas.height = BC_BASEMAP_TILE_SIZE;
    canvasContext = canvas.getContext('2d', { willReadFrequently: true });
  }

  return canvasContext;
};

/**
 * Whether a decoded tile is the service's blank tile. A browser that cannot read pixels treats every tile as content,
 * which keeps the basemap drawn rather than switching it off on a guess.
 *
 * @param {ImageBitmap} bitmap
 * @return {*}  {boolean}
 */
const isBlankTile = (bitmap: ImageBitmap): boolean => {
  const context = getCanvasContext();

  if (!context) {
    return false;
  }

  const { width, height } = bitmap;

  if (context.canvas.width !== width || context.canvas.height !== height) {
    context.canvas.width = width;
    context.canvas.height = height;
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0);

  return isSolidGrey(context.getImageData(0, 0, width, height).data, width, height);
};

/**
 * A fully transparent tile, handed to MapLibre in place of one the service has nothing for. Made per call: MapLibre
 * owns the bitmap it is given for the life of the tile.
 *
 * @return {*}  {Promise<ImageBitmap>}
 */
const createTransparentTile = (): Promise<ImageBitmap> => createImageBitmap(new ImageData(1, 1));

/**
 * Load one BC basemap tile for MapLibre, recording what the service held for it.
 *
 * A 404 and a blank tile are the same thing to the map: nothing to draw there, so both become a transparent tile and
 * are recorded as missing. A tile with content is handed over as decoded and recorded as such. Any other failure is
 * left to MapLibre and recorded as nothing, so a transient error does not stick to the tile.
 *
 * @param {RequestParameters} requestParameters - Carries the `bc-basemap://` URL.
 * @param {AbortController} abortController - Aborted by MapLibre when the tile leaves the viewport.
 * @return {*}  {Promise<GetResourceResponse<ImageBitmap>>}
 */
export const loadBcBasemapTile: AddProtocolAction = async (requestParameters, abortController) => {
  const { tile, template } = parseBcBasemapTileUrl(requestParameters.url);
  const key = bcTileKey(tile);

  const response = await fetch(buildProviderTileUrl(template, tile), { signal: abortController.signal });

  if (response.status === 404) {
    recordBcTileClassification(key, 'missing');

    return { data: await createTransparentTile() };
  }

  if (!response.ok) {
    throw new Error(`BC basemap tile ${key} failed: HTTP ${response.status}`);
  }

  const bitmap = await createImageBitmap(await response.blob());

  if (isBlankTile(bitmap)) {
    bitmap.close();
    recordBcTileClassification(key, 'missing');

    return { data: await createTransparentTile() };
  }

  recordBcTileClassification(key, 'content');

  return { data: bitmap };
};

let isRegistered = false;

/**
 * Register {@link loadBcBasemapTile} with MapLibre for the `bc-basemap://` scheme. Registration is global to
 * MapLibre and needed once per page, so repeated calls are harmless.
 */
export const registerBcBasemapProtocol = (): void => {
  if (isRegistered) {
    return;
  }

  addProtocol(BC_BASEMAP_PROTOCOL, loadBcBasemapTile);
  isRegistered = true;
};
