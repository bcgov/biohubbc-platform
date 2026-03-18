import { APIError } from 'hooks/api/useAxios';
import { CartWithFeaturesResponse } from 'interfaces/useCartApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { Dispatch } from 'react';
import { CartAction } from './cartContext.interface';

export type CartLifecycleApi = {
  getCartById: (cartId: string) => Promise<CartWithFeaturesResponse>;
  createCart: (payload: { features: number[] }) => Promise<CartWithFeaturesResponse>;
  assignCartToCurrentUser: (cartId: string) => Promise<void>;
};

export interface IUseCartLifecycleParams {
  cartApi: CartLifecycleApi;
  isAuthenticated: boolean;
  cartId: string | null;
  setStoredCartId: (value: string | null) => void;
  dispatch: Dispatch<CartAction>;
  applyLoadSuccess: (response: CartWithFeaturesResponse) => void;
  handleClaimError: (error: APIError) => void;
}

export interface IUseCartLifecycleResult {
  createCart: (options: { features?: SearchFeatureResultWithRelevancy[] }) => Promise<void>;
}
