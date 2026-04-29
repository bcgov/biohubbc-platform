import z from 'zod';

/**
 * Request parameters for searching properties
 */
export interface ISearchPropertyFilters {
  /** Free-text search term for properties (e.g., 'weight') */
  keyword?: string;
  /** Optional feature types to narrow the property search (e.g., ['species_observation']) */
  feature_types?: string[];
}

/**
 * Individual property result containing details and values grouped by type
 */
export const SearchPropertyResult = z.object({
  feature_property_id: z.number(),
  property_name: z.string(),
  property_display_name: z.string(),
  feature_property_type: z.enum(['string', 'number', 'boolean', 'datetime', 'taxon', 'spatial', 'code']),
  operators: z.array(z.string()),
  value_input: z.enum(['string', 'number', 'boolean', 'datetime', 'taxon', 'spatial', 'code']),
  relevancy_score: z.number()
});

export type SearchPropertyResult = z.infer<typeof SearchPropertyResult>;

/**
 * Grouped property results organized by value type
 */
export const GroupedPropertyResults = z.object({
  string: z.array(SearchPropertyResult),
  number: z.array(SearchPropertyResult),
  boolean: z.array(SearchPropertyResult),
  datetime: z.array(SearchPropertyResult),
  taxon: z.array(SearchPropertyResult),
  spatial: z.array(SearchPropertyResult),
  code: z.array(SearchPropertyResult)
});

export type GroupedPropertyResults = z.infer<typeof GroupedPropertyResults>;
