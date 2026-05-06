import { FEATURE_TYPE_CONFIG, PRIORITY_FEATURE_TYPE } from 'constants/feature-type';

/**
 * Converts a feature type name into the path segment used by search routes.
 *
 * Use this for route construction and route defaults so feature type values are
 * normalized consistently before being placed in `/search/:featureType`.
 *
 * @param {string} featureTypeName - Feature type name from constants, API metadata, or route state.
 * @returns {string} Lowercase search route segment for the feature type.
 */
export const toSearchFeatureRoute = (featureTypeName: string): string => featureTypeName.trim().toLowerCase();

/**
 * Builds a search result URL for a feature type and optional query params.
 *
 * Use this whenever navigating to a feature-type search result page. Empty,
 * null, and undefined query values are omitted so callers can pass partial
 * objects without producing blank URL parameters.
 *
 * @param {string} featureTypeName - Feature type name to place in the search URL path.
 * @param {Partial<Record<string, string | number | undefined>>} [params] - Optional query parameter values.
 * @returns {string} Search result URL for the feature type and supplied query parameters.
 */
export const buildSearchFeatureTypePath = (
  featureTypeName: string,
  params?: Partial<Record<string, string | number | undefined>>
): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  const path = `/search/${toSearchFeatureRoute(featureTypeName)}`;

  return queryString ? `${path}?${queryString}` : path;
};

/**
 * Resolves a route feature-type segment into page display metadata.
 *
 * Use this on search result pages after feature-type metadata has loaded. It
 * returns `null` for missing or unsupported route segments so callers can route
 * to the not-found page, and otherwise returns the normalized feature type name
 * plus the configured or API-provided page title.
 *
 * @param {string | undefined} route - Raw `:featureType` route parameter from the search URL.
 * @param {{ feature_type: { name: string; display_name: string } }[]} [availableFeatureTypes] - Feature types available from code metadata.
 * @returns {{ featureTypeName: string; title: string } | null} Search page route metadata, or null when the route is invalid.
 */
export const getSearchFeatureTypeRouteConfig = (
  route: string | undefined,
  availableFeatureTypes: { feature_type: { name: string; display_name: string } }[] = []
): { featureTypeName: string; title: string } | null => {
  const featureTypeName = route?.trim().toLowerCase();

  if (!featureTypeName) {
    return null;
  }

  const featureType = availableFeatureTypes.find((item) => item.feature_type.name === featureTypeName);

  if (!featureType) {
    return null;
  }

  const configuredLabel = FEATURE_TYPE_CONFIG[featureTypeName as PRIORITY_FEATURE_TYPE]?.label;

  return {
    featureTypeName,
    title: configuredLabel ?? featureType.feature_type.display_name
  };
};
