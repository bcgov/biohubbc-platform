import { buildMartinRequestTransform, resolveMartinTileUrlTemplate } from './martin-request';

const RELATIVE_TEMPLATE = '/martin/search/{z}/{x}/{y}';
const ABSOLUTE_TEMPLATE = 'https://tiles.example/martin/search/{z}/{x}/{y}';

/** A token holder shaped like the ref the session hooks expose. */
const buildTokenRef = (token: string | null) => ({ current: token });

describe('martin-request', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { origin: 'https://biohub.test' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('resolveMartinTileUrlTemplate', () => {
    it('resolves a relative template against the app origin', () => {
      expect(resolveMartinTileUrlTemplate(RELATIVE_TEMPLATE)).toBe('https://biohub.test/martin/search/{z}/{x}/{y}');
    });

    it('returns an absolute template unchanged', () => {
      expect(resolveMartinTileUrlTemplate(ABSOLUTE_TEMPLATE)).toBe(ABSOLUTE_TEMPLATE);
    });
  });

  describe('buildMartinRequestTransform', () => {
    it('attaches the token to a tile minted from the template', () => {
      const transform = buildMartinRequestTransform(RELATIVE_TEMPLATE, buildTokenRef('token-abc'));

      expect(transform('https://biohub.test/martin/search/5/5/11')).toEqual({
        url: 'https://biohub.test/martin/search/5/5/11',
        headers: { Authorization: 'Bearer token-abc' }
      });
    });

    it('matches a tile carrying the cache-busting query', () => {
      const transform = buildMartinRequestTransform(RELATIVE_TEMPLATE, buildTokenRef('token-abc'));

      expect(transform('https://biohub.test/martin/search/5/5/11?ctx=ctx-1')).toEqual({
        url: 'https://biohub.test/martin/search/5/5/11?ctx=ctx-1',
        headers: { Authorization: 'Bearer token-abc' }
      });
    });

    it('attaches the token to tiles of an absolute template', () => {
      const transform = buildMartinRequestTransform(ABSOLUTE_TEMPLATE, buildTokenRef('token-abc'));

      expect(transform('https://tiles.example/martin/search/5/5/11')).toEqual({
        url: 'https://tiles.example/martin/search/5/5/11',
        headers: { Authorization: 'Bearer token-abc' }
      });
    });

    it('leaves requests to other hosts untouched', () => {
      const transform = buildMartinRequestTransform(RELATIVE_TEMPLATE, buildTokenRef('token-abc'));

      // The basemap provider receives the request exactly as MapLibre built it: no header, so no preflight.
      expect(transform('https://tiles.openfreemap.org/styles/bright')).toEqual({
        url: 'https://tiles.openfreemap.org/styles/bright'
      });
      expect(transform('https://tiles.openfreemap.org/planet/5/5/11.pbf')).toEqual({
        url: 'https://tiles.openfreemap.org/planet/5/5/11.pbf'
      });
    });

    it('leaves a same-origin request outside the tile path untouched', () => {
      const transform = buildMartinRequestTransform(RELATIVE_TEMPLATE, buildTokenRef('token-abc'));

      expect(transform('https://biohub.test/config')).toEqual({ url: 'https://biohub.test/config' });
    });

    it('sends Martin requests bare until a token exists', () => {
      const transform = buildMartinRequestTransform(RELATIVE_TEMPLATE, buildTokenRef(null));

      expect(transform('https://biohub.test/martin/search/5/5/11')).toEqual({
        url: 'https://biohub.test/martin/search/5/5/11'
      });
    });

    it('sends every request bare when there is no template to scope the token to', () => {
      const transform = buildMartinRequestTransform(undefined, buildTokenRef('token-abc'));

      expect(transform('https://biohub.test/martin/search/5/5/11')).toEqual({
        url: 'https://biohub.test/martin/search/5/5/11'
      });
    });

    it('reads the token at request time', () => {
      const tokenRef = buildTokenRef('token-1');
      const transform = buildMartinRequestTransform(RELATIVE_TEMPLATE, tokenRef);

      transform('https://biohub.test/martin/search/5/5/11');
      tokenRef.current = 'token-2';

      expect(transform('https://biohub.test/martin/search/5/5/11')).toEqual({
        url: 'https://biohub.test/martin/search/5/5/11',
        headers: { Authorization: 'Bearer token-2' }
      });
    });
  });
});
