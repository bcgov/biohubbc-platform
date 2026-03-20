import { z } from 'zod';

export enum FEATURE_PROPERTY_TYPE {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  OBJECT = 'object',
  SPATIAL = 'spatial',
  DATETIME = 'datetime',
  CODE = 'code',
  TAXON = 'taxon',
  ARTIFACT_KEY = 'artifact_key'
}

export const FeaturePropertyTypeName = z.nativeEnum(FEATURE_PROPERTY_TYPE);

export const FeatureType = z.object({
  feature_type_id: z.number(),
  feature_type_name: z.string(),
  feature_type_display_name: z.string()
});

export type FeatureType = z.infer<typeof FeatureType>;

export const FeatureProperty = z.object({
  feature_property_id: z.number(),
  feature_property_name: z.string(),
  feature_property_display_name: z.string(),
  feature_property_type_id: z.number(),
  feature_property_type_name: FeaturePropertyTypeName
});

export type FeatureProperty = z.infer<typeof FeatureProperty>;

export const FeatureTypePropertyExtended = FeatureType.merge(FeatureProperty);

export type FeatureTypePropertyExtended = z.infer<typeof FeatureTypePropertyExtended>;

export const FeatureTypeWithFeatureProperties = z.object({
  feature_type: FeatureType,
  feature_type_properties: z.array(FeatureProperty)
});

export type FeatureTypeWithFeatureProperties = z.infer<typeof FeatureTypeWithFeatureProperties>;
