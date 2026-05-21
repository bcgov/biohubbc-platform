import { FEATURE_TYPE_CONFIG, PRIORITY_FEATURE_TYPE } from 'constants/feature-type';
import { IGetAllCodeSetsResponse } from 'interfaces/useCodesApi.interface';
import { buildSearchFeatureTypePath } from 'utils/routes';
import { ISearchContainerLink } from '../container/tab/SearchTabs.interface';

const SEARCH_FEATURE_TYPE_ORDER: PRIORITY_FEATURE_TYPE[] = [
  PRIORITY_FEATURE_TYPE.SPECIES_OBSERVATION,
  PRIORITY_FEATURE_TYPE.TELEMETRY,
  PRIORITY_FEATURE_TYPE.HABITAT_FEATURE,
  PRIORITY_FEATURE_TYPE.DATASET,
  PRIORITY_FEATURE_TYPE.REPORT
];

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
