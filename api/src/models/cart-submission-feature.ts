import { z } from 'zod';
import { ApiPaginationOptions } from '../zod-schema/pagination';

export const CartSubmissionFeature = z.object({
  cart_id: z.string().uuid(),
  submission_feature_id: z.number()
});

export type CartSubmissionFeature = z.infer<typeof CartSubmissionFeature>;

export interface AddSubmissionFeaturesToCartParams {
  cartId: string;
  submissionFeatureIds: number[];
  systemUserId: number;
}

export interface RemoveSubmissionFeaturesFromCartParams {
  cartId: string;
  submissionFeatureIds: number[];
  systemUserId: number;
}

export interface ClearCartParams {
  cartId: string;
  systemUserId: number;
}

export interface GetCartSubmissionFeaturesParams {
  cartId: string;
  pagination?: ApiPaginationOptions;
  systemUserId: number;
}

export interface GetCartSubmissionFeatureCountParams {
  cartId: string;
  systemUserId: number;
}
