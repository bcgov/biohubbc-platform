import { FEATURE_TYPE_CONFIG, PRIORITY_FEATURE_TYPE } from 'constants/feature-type';
import { IGetAllCodeSetsResponse } from 'interfaces/useCodesApi.interface';
import { buildSearchFeatureTypePath } from 'utils/routes';
import { ISearchContainerLink } from '../container/tab/SearchTabs.interface';

const SEARCH_FEATURE_TYPE_ORDER: PRIORITY_FEATURE_TYPE[] = [
  PRIORITY_FEATURE_TYPE.SPECIES_OBSERVATION,
  PRIORITY_FEATURE_TYPE.TELEMETRY,
  PRIORITY_FEATURE_TYPE.HABITAT_FEATURE,
  PRIORITY_FEATURE_TYPE.SURVEY,
  PRIORITY_FEATURE_TYPE.REPORT
];

/**
 * Builds the landing page's feature-type quick links: the priority feature types, in their configured order, that the
 * current code metadata contains.
 *
 * @param {IGetAllCodeSetsResponse['feature_type_with_properties'] | undefined} featureTypes - Active feature types.
 * @returns {ISearchContainerLink[]} The priority feature-type links.
 */
export const buildSearchFeatureTypeLinks = (
  featureTypes: IGetAllCodeSetsResponse['feature_type_with_properties'] | undefined
): ISearchContainerLink[] =>
  SEARCH_FEATURE_TYPE_ORDER.map<ISearchContainerLink | null>((typeName) => {
    const featureType = featureTypes?.find((item) => item.feature_type.name === typeName);

    if (!featureType) {
      return null;
    }

    return {
      value: typeName,
      label: FEATURE_TYPE_CONFIG[typeName].label,
      to: buildSearchFeatureTypePath(typeName)
    };
  }).filter((link): link is ISearchContainerLink => link !== null);

/**
 * Builds the search result page's feature-type tabs: every active feature type in the code metadata. The priority
 * feature types come first in their configured order, then every other feature type in the order the metadata lists
 * them. A feature type without a configured label is labelled by its display name, as its result page is titled.
 *
 * @param {IGetAllCodeSetsResponse['feature_type_with_properties'] | undefined} featureTypes - Active feature types.
 * @returns {ISearchContainerLink[]} A link for every active feature type.
 */
export const buildAllSearchFeatureTypeLinks = (
  featureTypes: IGetAllCodeSetsResponse['feature_type_with_properties'] | undefined
): ISearchContainerLink[] => {
  const priorityLinks = buildSearchFeatureTypeLinks(featureTypes);
  const priorityNames = new Set(priorityLinks.map((link) => link.value));

  const otherLinks = (featureTypes ?? [])
    .filter((item) => !priorityNames.has(item.feature_type.name))
    .map((item) => ({
      value: item.feature_type.name,
      label: item.feature_type.display_name,
      to: buildSearchFeatureTypePath(item.feature_type.name)
    }));

  return [...priorityLinks, ...otherLinks];
};
