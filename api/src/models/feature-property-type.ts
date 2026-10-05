import { z } from 'zod';

export const FeaturePropertyType = z.object({ feature_property_type_id: z.number(), name: z.string() });
export type FeaturePropertyType = z.infer<typeof FeaturePropertyType>;
