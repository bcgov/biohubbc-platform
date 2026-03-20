import { z } from 'zod';
import { FeatureTypeWithFeatureProperties } from './feature-property';

export const IAllCodeSets = z.object({
  feature_type_with_properties: z.array(FeatureTypeWithFeatureProperties)
});

export type IAllCodeSets = z.infer<typeof IAllCodeSets>;
