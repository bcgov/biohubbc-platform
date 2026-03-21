import { z } from 'zod';
import type { CreateSubmissionFeatureArtifact } from '../models/submission-feature-artifact';
import type { CreateSubmissionFeaturePropertyBoolean } from '../models/submission-feature-property-boolean';
import type { CreateSubmissionFeaturePropertyCode } from '../models/submission-feature-property-code';
import type { CreateSubmissionFeaturePropertyGeometry } from '../models/submission-feature-property-geometry';
import type { CreateSubmissionFeaturePropertyNumber } from '../models/submission-feature-property-number';
import type { CreateSubmissionFeaturePropertyString } from '../models/submission-feature-property-string';
import type { CreateSubmissionFeaturePropertyTaxon } from '../models/submission-feature-property-taxon';
import type { CreateSubmissionFeaturePropertyTimestamp } from '../models/submission-feature-property-timestamp';
import type { CodeReference } from '../utils/code-reference';
import { GeoJSONFeatureCollectionZodSchema } from '../zod-schema/geoJsonZodSchema';

// Searchable record schemas
const SearchableRecord = z.object({
  submission_feature_id: z.number(),
  feature_property_id: z.number(),
  value: z.unknown()
});

const InsertSearchableRecordKeys = {
  submission_feature_id: true,
  feature_property_id: true,
  value: true
} as const;

export const DatetimeSearchableRecord = SearchableRecord.extend({
  search_datetime_id: z.number(),
  value: z.string()
});

export const NumberSearchableRecord = SearchableRecord.extend({
  search_number_id: z.number(),
  value: z.number()
});

export const StringSearchableRecord = SearchableRecord.extend({
  search_string_id: z.number(),
  value: z.string()
});

export const SpatialSearchableRecord = SearchableRecord.extend({
  search_spatial_id: z.number(),
  value: z.any() // GeoJSON
});

export const InsertDatetimeSearchableRecord = DatetimeSearchableRecord.pick(InsertSearchableRecordKeys);
export const InsertNumberSearchableRecord = NumberSearchableRecord.pick(InsertSearchableRecordKeys);
export const InsertStringSearchableRecord = StringSearchableRecord.pick(InsertSearchableRecordKeys);
export const InsertSpatialSearchableRecord = SpatialSearchableRecord.pick(InsertSearchableRecordKeys).extend({
  value: GeoJSONFeatureCollectionZodSchema
});

// Search result schema
export const SearchFeatureResultWithRelevancy = z.object({
  submission_feature_id: z.number(),
  submission_id: z.number(),
  uuid: z.string(),
  feature_type_id: z.number(),
  feature_type_name: z.string(),
  feature_name: z.string().nullable(),
  feature_description: z.string().nullable(),
  submission_name: z.string(),
  is_secured: z.boolean(),
  relevancy_score: z.number(),
  create_date: z.string()
});

export type SearchableRecord = z.infer<typeof SearchableRecord>;
export type DatetimeSearchableRecord = z.infer<typeof DatetimeSearchableRecord>;
export type NumberSearchableRecord = z.infer<typeof NumberSearchableRecord>;
export type StringSearchableRecord = z.infer<typeof StringSearchableRecord>;
export type SpatialSearchableRecord = z.infer<typeof SpatialSearchableRecord>;
export type InsertDatetimeSearchableRecord = z.infer<typeof InsertDatetimeSearchableRecord>;
export type InsertNumberSearchableRecord = z.infer<typeof InsertNumberSearchableRecord>;
export type InsertStringSearchableRecord = z.infer<typeof InsertStringSearchableRecord>;
export type InsertSpatialSearchableRecord = z.infer<typeof InsertSpatialSearchableRecord>;
export type SearchFeatureResultWithRelevancy = z.infer<typeof SearchFeatureResultWithRelevancy>;

/**
 * Zod schema for property filter
 */
export const SearchPropertyFilter = z.object({
  featureTypeName: z.string(),
  propertyName: z.string(),
  propertyType: z.enum(['string', 'number', 'timestamp']),
  operator: z.enum([
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'contains',
    'starts_with',
    'ends_with',
    'in',
    'not_in',
    'exists'
  ]),
  value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]).optional(),
  negate: z.boolean().optional()
});

/**
 * Supported comparison operators for property filters.
 */
export type SearchComparisonOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'exists';

/**
 * Allowed value types for property comparisons.
 */
export type SearchPropertyValue = string | number | boolean | Array<string | number>;

/**
 * Defines a single property condition in a filter group.
 */
export const SearchFeaturePropertyCondition = z.object({
  name: z.string(),
  operator: z.enum([
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'contains',
    'starts_with',
    'ends_with',
    'in',
    'not_in',
    'exists'
  ]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))])
});
export type SearchFeaturePropertyCondition = z.infer<typeof SearchFeaturePropertyCondition>;

/**
 * Defines a group of property conditions combined by a logical operand.
 */
export const SearchFeaturePropertyGroup = z.object({
  operand: z.enum(['and', 'or']),
  conditions: z.array(SearchFeaturePropertyCondition)
});
export type SearchFeaturePropertyGroup = z.infer<typeof SearchFeaturePropertyGroup>;

/**
 * Canonical filters for feature search (frontend + backend aligned)
 */
export const SearchFeatureFilters = z.object({
  /**
   * Free-text keyword search across all searchable properties.
   */
  keyword: z.string().optional(),

  /**
   * Filter results by one or more feature types (e.g., species_observation).
   */
  feature_types: z.array(z.string()).optional(),

  /**
   * Filter results by one or more species.
   */
  species: z.array(z.string()).optional(),

  /**
   * Structured property filters grouped by logical operand.
   */
  properties: z.array(SearchFeaturePropertyGroup).optional()
});

export type SearchFeaturesFilters = z.infer<typeof SearchFeatureFilters>;

export interface PendingPropertyRecord {
  submission_feature_id: number;
  feature_type_property_id: number;
  propertyName: string;
}

export type PendingTaxonRecord = PendingPropertyRecord & {
  tsn: number;
};

export type PendingCodeRecord = PendingPropertyRecord & {
  codeReference: CodeReference;
};

export type PendingArtifactRecord = PendingPropertyRecord & {
  reference: string;
};

export type PropertyRecordBuckets = {
  stringRecords: CreateSubmissionFeaturePropertyString[];
  numberRecords: CreateSubmissionFeaturePropertyNumber[];
  booleanRecords: CreateSubmissionFeaturePropertyBoolean[];
  timestampRecords: CreateSubmissionFeaturePropertyTimestamp[];
  artifactRecords: CreateSubmissionFeatureArtifact[];
  pendingArtifactRecords: PendingArtifactRecord[];
  codeRecords: CreateSubmissionFeaturePropertyCode[];
  pendingCodeRecords: PendingCodeRecord[];
  geometryRecords: CreateSubmissionFeaturePropertyGeometry[];
  taxonRecords: CreateSubmissionFeaturePropertyTaxon[];
  pendingTaxonRecords: PendingTaxonRecord[];
};
