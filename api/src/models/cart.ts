import z from 'zod';
import { SubmissionFeature } from '../repositories/submission-repository';

export enum CartStatus {
  ACTIVE = 'active',
  CHECKED_OUT = 'checked_out',
  EXPIRED = 'expired',
  ABANDONED = 'abandoned'
}

export const Cart = z.object({
  cart_id: z.string(),
  system_user_id: z.number(),
  cart_status: z.nativeEnum(CartStatus)
});

export type Cart = z.infer<typeof Cart>;

export const CartWithFeatures = Cart.extend({ features: z.array(SubmissionFeature) });
export type CartWithFeatures = z.infer<typeof CartWithFeatures>;

export interface UpdateCart {
  cart_status?: CartStatus;
  record_end_date?: string | null;
}
