import { z } from 'zod';
import { FeatureTypeWithFeaturePropertiesCode } from './feature-property';

export const IAllCodeSets = z.object({
  feature_type_with_properties: z.array(FeatureTypeWithFeaturePropertiesCode)
});

export type IAllCodeSets = z.infer<typeof IAllCodeSets>;
