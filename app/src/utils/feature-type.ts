import { FEATURE_TYPE, FEATURE_TYPE_DISPLAY_LABEL } from 'constants/feature-type';
import { startCase } from 'lodash-es';

/**
 * Resolves a feature type identifier to its frontend display label.
 * Unconfigured types fall back to a readable label derived from their identifier.
 *
 * @param {string} featureTypeName - Stable feature type name returned by the API.
 * @returns {string} Configured display label, or a formatted identifier for an unknown type.
 */
export const getFeatureTypeDisplayLabel = (featureTypeName: string): string =>
  FEATURE_TYPE_DISPLAY_LABEL[featureTypeName as FEATURE_TYPE] ?? startCase(featureTypeName);
