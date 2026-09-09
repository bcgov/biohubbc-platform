import { BC_BASEMAP_BLANK_TILE_TOLERANCE, BC_BASEMAP_SAMPLE_STEP } from 'constants/basemap';
import {
  BC_BASEMAP_PROTOCOL,
  buildBcBasemapTileUrlTemplate,
  buildProviderTileUrl,
  isSolidGrey,
  loadBcBasemapTile,
  parseBcBasemapTileUrl,
  registerBcBasemapProtocol
} from './bc-basemap-protocol';
import { clearBcTileClassifications, findBcTileClassification } from './bc-basemap-registry';

const mocks = vi.hoisted(() => ({
  addProtocol: vi.fn()
}));

vi.mock('maplibre-gl', () => ({ addProtocol: mocks.addProtocol }));

const PROVIDER_TEMPLATE = 'https://maps.gov.bc.ca/arcgis/rest/services/province/roads_wm/MapServer/tile/{z}/{y}/{x}';
const TILE_SIZE = 256;

/** RGBA pixels of a tile: the service's grey everywhere, with any overrides applied by pixel index. */
const buildPixels = (overrides: Record<number, [number, number, number]> = {}): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);

  for (let index = 0; index < TILE_SIZE * TILE_SIZE; index++) {
    const [red, green, blue] = overrides[index] ?? [204, 204, 204];
    data.set([red, green, blue, 255], index * 4);
  }

  return data;
};

/** A decoded tile as the handler sees it: its pixels travel on the fake blob into the fake bitmap. */
interface IFakeBitmap {
  width: number;
  height: number;
  pixels?: Uint8ClampedArray;
  close: ReturnType<typeof vi.fn>;
}

/** What the fake 2D context last drew, so `getImageData` can answer with its pixels. */
let drawnBitmap: IFakeBitmap | undefined;

const fetchMock = vi.fn();

const tileUrl = (z: number, x: number, y: number) =>
  `${BC_BASEMAP_PROTOCOL}://${z}/${x}/${y}?template=${encodeURIComponent(PROVIDER_TEMPLATE)}`;

const respond = (status: number, pixels?: Uint8ClampedArray) =>
  fetchMock.mockResolvedValueOnce({ status, ok: status >= 200 && status < 300, blob: async () => ({ pixels }) });

const load = (z = 11, x = 323, y = 700, abortController = new AbortController()) =>
  loadBcBasemapTile({ url: tileUrl(z, x, y) }, abortController);

describe('bc-basemap-protocol', () => {
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      return {
        canvas: this,
        clearRect: vi.fn(),
        drawImage: vi.fn((bitmap: IFakeBitmap) => {
          drawnBitmap = bitmap;
        }),
        getImageData: vi.fn(() => ({ data: drawnBitmap?.pixels }))
      } as unknown as CanvasRenderingContext2D;
    });
  });

  beforeEach(() => {
    clearBcTileClassifications();
    drawnBitmap = undefined;
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'ImageData',
      class {
        constructor(
          public width: number,
          public height: number
        ) {}
      }
    );
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(
        async (source: { pixels?: Uint8ClampedArray; width?: number }): Promise<IFakeBitmap> =>
          source.width === 1
            ? { width: 1, height: 1, close: vi.fn() }
            : { width: TILE_SIZE, height: TILE_SIZE, pixels: source.pixels, close: vi.fn() }
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('tile urls', () => {
    it('carries the provider template past MapLibre without a brace it could substitute', () => {
      const template = buildBcBasemapTileUrlTemplate(PROVIDER_TEMPLATE);

      expect(template).toBe(`${BC_BASEMAP_PROTOCOL}://{z}/{x}/{y}?template=${encodeURIComponent(PROVIDER_TEMPLATE)}`);
      expect(template.split('?')[1]).not.toMatch(/[{}]/);
    });

    it('reads the tile and template back out of a minted url', () => {
      expect(parseBcBasemapTileUrl(tileUrl(11, 323, 700))).toEqual({
        tile: { z: 11, x: 323, y: 700 },
        template: PROVIDER_TEMPLATE
      });
    });

    it('rejects a url it did not mint', () => {
      expect(() => parseBcBasemapTileUrl('https://maps.gov.bc.ca/tile/11/700/323')).toThrow();
    });

    it("honours the provider's own placeholder order", () => {
      expect(buildProviderTileUrl(PROVIDER_TEMPLATE, { z: 11, x: 323, y: 700 })).toBe(
        'https://maps.gov.bc.ca/arcgis/rest/services/province/roads_wm/MapServer/tile/11/700/323'
      );
    });
  });

  describe('isSolidGrey', () => {
    it('recognises the blank tile', () => {
      expect(isSolidGrey(buildPixels(), TILE_SIZE, TILE_SIZE)).toBe(true);
    });

    it('tolerates the quantisation noise a JPEG adds to it', () => {
      const tolerated = 204 + BC_BASEMAP_BLANK_TILE_TOLERANCE;

      expect(isSolidGrey(buildPixels({ 0: [tolerated, tolerated, tolerated] }), TILE_SIZE, TILE_SIZE)).toBe(true);
    });

    it('rejects a tile with any sampled pixel that is not the blank grey', () => {
      const sampledIndex = BC_BASEMAP_SAMPLE_STEP * TILE_SIZE + BC_BASEMAP_SAMPLE_STEP;
      const offGrey = 204 + BC_BASEMAP_BLANK_TILE_TOLERANCE + 1;

      expect(isSolidGrey(buildPixels({ [sampledIndex]: [offGrey, 204, 204] }), TILE_SIZE, TILE_SIZE)).toBe(false);
    });

    it('never calls an empty or truncated image blank', () => {
      expect(isSolidGrey(new Uint8ClampedArray(0), 0, 0)).toBe(false);
      expect(isSolidGrey(new Uint8ClampedArray(16), TILE_SIZE, TILE_SIZE)).toBe(false);
    });
  });

  describe('loadBcBasemapTile', () => {
    it('hands MapLibre a transparent tile and records a missing one where the service has no tile', async () => {
      respond(404);

      const response = await load();

      expect(response.data).toMatchObject({ width: 1, height: 1 });
      expect(findBcTileClassification('11/323/700')).toBe('missing');
      expect(drawnBitmap).toBeUndefined();
    });

    it('hands MapLibre a transparent tile and records a missing one where the service answered blank grey', async () => {
      respond(200, buildPixels());

      const response = await load(11, 428, 690);

      expect(response.data).toMatchObject({ width: 1, height: 1 });
      expect(findBcTileClassification('11/428/690')).toBe('missing');
    });

    it('hands MapLibre the decoded tile and records content where the service drew something', async () => {
      const pixels = buildPixels({ 0: [30, 60, 90] });
      respond(200, pixels);

      const response = await load();

      expect(response.data).toMatchObject({ width: TILE_SIZE, height: TILE_SIZE, pixels });
      expect(findBcTileClassification('11/323/700')).toBe('content');
    });

    it('fetches the provider url the template names, with the abort signal MapLibre gave it', async () => {
      respond(404);
      const abortController = new AbortController();

      await load(11, 323, 700, abortController);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://maps.gov.bc.ca/arcgis/rest/services/province/roads_wm/MapServer/tile/11/700/323',
        { signal: abortController.signal }
      );
    });

    it('leaves any other failure to MapLibre and records nothing for the tile', async () => {
      respond(500);

      await expect(load()).rejects.toThrow('HTTP 500');
      expect(findBcTileClassification('11/323/700')).toBeUndefined();
    });

    it('propagates an abort and records nothing for the tile', async () => {
      const abortError = new DOMException('aborted', 'AbortError');
      fetchMock.mockRejectedValueOnce(abortError);

      await expect(load()).rejects.toBe(abortError);
      expect(findBcTileClassification('11/323/700')).toBeUndefined();
    });
  });

  describe('registerBcBasemapProtocol', () => {
    it('registers the handler with MapLibre once, however often it is asked', () => {
      registerBcBasemapProtocol();
      registerBcBasemapProtocol();

      expect(mocks.addProtocol).toHaveBeenCalledTimes(1);
      expect(mocks.addProtocol).toHaveBeenCalledWith(BC_BASEMAP_PROTOCOL, loadBcBasemapTile);
    });
  });
});
