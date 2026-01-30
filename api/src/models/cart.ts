import z from 'zod';

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

export interface UpdateCart {
  system_user_id?: string | null;
  cart_status?: CartStatus;
  record_end_date?: string | null;
}
