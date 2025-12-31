import { z } from 'zod';
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
  relevancy_score: z.number()
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
  propertyType: z.enum(['string', 'number', 'datetime']),
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
export const SearchFeaturePropertyConditionSchema = z.object({
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
export type ISearchFeaturePropertyCondition = z.infer<typeof SearchFeaturePropertyConditionSchema>;

/**
 * Defines a group of property conditions combined by a logical operand.
 */
export const SearchFeaturePropertyGroupSchema = z.object({
  operand: z.enum(['and', 'or']),
  conditions: z.array(SearchFeaturePropertyConditionSchema)
});
export type ISearchFeaturePropertyGroup = z.infer<typeof SearchFeaturePropertyGroupSchema>;

/**
 * Canonical filters for feature search (frontend + backend aligned)
 */
export const SearchFeatureFiltersSchema = z.object({
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
  properties: z.array(SearchFeaturePropertyGroupSchema).optional()
});

export type ISearchFeaturesFilters = z.infer<typeof SearchFeatureFiltersSchema>;
