import { z } from 'zod';
import { FeatureTypeWithProperties } from './feature-type';

export const IAllCodeSets = z.object({
  feature_type_with_properties: z.array(FeatureTypeWithProperties)
});

export type IAllCodeSets = z.infer<typeof IAllCodeSets>;
