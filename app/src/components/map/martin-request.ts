import type { RequestTransformFunction } from 'maplibre-gl';
import type { RefObject } from 'react';

/**
 * Resolve a Martin tile URL template to an absolute one.
 *
 * The API returns the template relative (`/martin/search/{z}/{x}/{y}`), so it resolves against the app's own origin:
 * the same path is served by the dev server proxy locally and by an OpenShift route when deployed. An absolute
 * template is returned unchanged.
 *
 * @param {string} martinUrlTemplate - Template from a Martin session.
 * @return {*}  {string} Absolute template, placeholders intact.
 */
export const resolveMartinTileUrlTemplate = (martinUrlTemplate: string): string =>
  martinUrlTemplate.startsWith('http') ? martinUrlTemplate : `${window.location.origin}${martinUrlTemplate}`;

/**
 * The prefix every tile minted from a template shares: the text before its first placeholder.
 *
 * @param {string} absoluteTemplate - Output of {@link resolveMartinTileUrlTemplate}.
 * @return {*}  {string}
 */
const tileUrlPrefix = (absoluteTemplate: string): string => {
  const placeholderIndex = absoluteTemplate.indexOf('{');

  return placeholderIndex === -1 ? absoluteTemplate : absoluteTemplate.slice(0, placeholderIndex);
};

/**
 * Build a MapLibre `transformRequest` that attaches the Martin tile token to Martin tile requests alone.
 *
 * MapLibre routes every request it makes through this one hook: the basemap style, its tiles, glyphs and sprites as
 * well as the Martin tiles. The header is scoped by URL because the token is a credential for one origin, and a
 * cross-origin request carrying `Authorization` is preflighted, which a basemap provider need not answer. The token
 * is read from the ref at request time, so a refreshed token applies to the next request without the map being
 * rebuilt; until a session holds a token, Martin requests go out bare.
 *
 * @param {string} [martinUrlTemplate] - Template from the Martin session, relative or absolute. Without one, no
 *   request carries the token.
 * @param {RefObject<string | null>} tokenRef - Current tile token, `null` before a session exists.
 * @return {*}  {RequestTransformFunction}
 */
export const buildMartinRequestTransform = (
  martinUrlTemplate: string | undefined,
  tokenRef: RefObject<string | null>
): RequestTransformFunction => {
  const prefix = martinUrlTemplate ? tileUrlPrefix(resolveMartinTileUrlTemplate(martinUrlTemplate)) : null;

  return (url) => {
    const token = tokenRef.current;

    if (!token || !prefix || !url.startsWith(prefix)) {
      return { url };
    }

    return { url, headers: { Authorization: `Bearer ${token}` } };
  };
};
