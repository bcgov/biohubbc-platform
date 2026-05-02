import { FEATURE_TYPE_CONFIG, PRIORITY_FEATURE_TYPE } from 'constants/feature-type';
import { IGetAllCodeSetsResponse } from 'interfaces/useCodesApi.interface';
import { buildSearchFeatureTypePath } from 'utils/routes';
import { ISearchContainerLink } from '../container/tab/SearchTabs.interface';

/**
 * Builds the ordered set of search result tabs for available feature types.
 *
 * Use this on the search landing page after code-set feature metadata has
 * loaded. It preserves the configured feature-type order, skips feature types
 * not present in the API response, and generates each tab URL through the
 * shared search route helper.
 *
 * @param {IGetAllCodeSetsResponse['feature_type_with_properties'] | undefined} featureTypes - Feature type metadata returned by the codes API.
 * @returns {ISearchContainerLink[]} Ordered search tab links for the available feature types.
 */
export const buildSearchFeatureTypeLinks = (
  featureTypes: IGetAllCodeSetsResponse['feature_type_with_properties'] | undefined
): ISearchContainerLink[] =>
  Object.values(PRIORITY_FEATURE_TYPE)
    .map<ISearchContainerLink | null>((typeName) => {
      const featureType = featureTypes?.find((item) => item.feature_type.name === typeName);

      if (!featureType) {
        return null;
      }

      return {
        label: FEATURE_TYPE_CONFIG[typeName].label,
        to: buildSearchFeatureTypePath(typeName)
      };
    })
    .filter((link): link is ISearchContainerLink => link !== null) ?? [];
