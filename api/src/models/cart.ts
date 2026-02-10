import z from 'zod';
import { ApiPaginationResults } from '../zod-schema/pagination';

export enum CartStatus {
  ACTIVE = 'active',
  CHECKED_OUT = 'checked_out',
  EXPIRED = 'expired',
  ABANDONED = 'abandoned'
}

export const CartSubmissionFeature = z.object({
  cart_submission_feature_id: z.string(),
  submission_feature_id: z.number(),
  submission_id: z.number(),
  feature_type_id: z.number(),
  feature_type_name: z.string(),
  secured: z.boolean()
});

export type CartSubmissionFeature = z.infer<typeof CartSubmissionFeature>;

export const Cart = z.object({
  cart_id: z.string(),
  system_user_id: z.number().nullable(),
  cart_status: z.nativeEnum(CartStatus)
});

export type Cart = z.infer<typeof Cart>;

export const CartWithFeatures = Cart.extend({ features: z.array(CartSubmissionFeature) });
export type CartWithFeatures = z.infer<typeof CartWithFeatures>;

export const UpdateCart = z.object({
  system_user_id: z.number().nullable().optional(),
  cart_status: z.nativeEnum(CartStatus).optional(),
  record_end_date: z.string().nullable().optional()
});

export type UpdateCart = z.infer<typeof UpdateCart>;

export const CartFeatureListResponse = z.object({
  features: z.array(CartSubmissionFeature),
  pagination: ApiPaginationResults
});

export type CartFeatureListResponse = z.infer<typeof CartFeatureListResponse>;

export const CartWithFeaturesResponse = z.object({
  cart: Cart,
  features: z.array(CartSubmissionFeature),
  pagination: ApiPaginationResults
});

export type CartWithFeaturesResponse = z.infer<typeof CartWithFeaturesResponse>;
