import { z } from 'zod';

export const FeaturePropertyTypeName = z.enum([
  'string',
  'number',
  'boolean',
  'object',
  'spatial',
  'datetime',
  'code',
  'taxon',
  'artifact_key'
]);

export type FeaturePropertyTypeName = z.infer<typeof FeaturePropertyTypeName>;

export const FeatureTypeCode = z.object({
  feature_type_id: z.number(),
  feature_type_name: z.string(),
  feature_type_display_name: z.string()
});

export type FeatureTypeCode = z.infer<typeof FeatureTypeCode>;

export const FeaturePropertyCode = z.object({
  feature_property_id: z.number(),
  feature_property_name: z.string(),
  feature_property_display_name: z.string(),
  feature_property_type_id: z.number(),
  feature_property_type_name: FeaturePropertyTypeName
});

export type FeaturePropertyCode = z.infer<typeof FeaturePropertyCode>;

export const FeatureTypePropertyCodeRow = FeatureTypeCode.merge(FeaturePropertyCode);

export type FeatureTypePropertyCodeRow = z.infer<typeof FeatureTypePropertyCodeRow>;

export const FeatureTypeWithFeaturePropertiesCode = z.object({
  feature_type: FeatureTypeCode,
  feature_type_properties: z.array(FeaturePropertyCode)
});

export type FeatureTypeWithFeaturePropertiesCode = z.infer<typeof FeatureTypeWithFeaturePropertiesCode>;
