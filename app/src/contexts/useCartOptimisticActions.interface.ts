import { CartFeatureListResponse } from 'interfaces/useCartApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { CartSnapshot, CartState } from './cartContext.interface';

export type CartOptimisticActionsApi = {
  addCartFeatures: (
    cartId: string,
    payload: { features: number[] },
    pagination: { page: number; limit: number }
  ) => Promise<CartFeatureListResponse>;
  removeCartFeatureById: (
    cartId: string,
    cartSubmissionFeatureId: string,
    pagination: { page: number; limit: number }
  ) => Promise<CartFeatureListResponse>;
  clearCart: (cartId: string, pagination: { page: number; limit: number }) => Promise<CartFeatureListResponse>;
};

export interface IUseCartOptimisticActionsParams {
  state: CartState;
  cartApi: CartOptimisticActionsApi;
  applyLoadSuccess: (response: CartFeatureListResponse) => void;
  applyRollback: (snapshot: CartSnapshot) => void;
  applyOptimisticSnapshot: (snapshot: CartSnapshot) => void;
}

export interface IUseCartOptimisticActionsResult {
  addToExistingCart: (cartId: string, optimisticAdds: SearchFeatureResultWithRelevancy[]) => Promise<void>;
  removeFromExistingCart: (cartId: string, featureIds: number[]) => Promise<void>;
  clearExistingCart: (cartId: string) => Promise<void>;
}
