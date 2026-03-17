import { CartWithFeaturesResponse } from 'interfaces/useCartApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { Dispatch } from 'react';
import { CartAction, CartState } from './cartContext.interface';

export type CartLifecycleApi = {
  getCartById: (cartId: string) => Promise<CartWithFeaturesResponse>;
  createCart: (payload: { features: number[] }) => Promise<CartWithFeaturesResponse>;
  assignCartToCurrentUser: (cartId: string) => Promise<void>;
};

export interface IUseCartLifecycleParams {
  cartApi: CartLifecycleApi;
  isAuthenticated: boolean;
  storedCartId: string | null;
  setStoredCartId: (value: string | null) => void;
  state: CartState;
  dispatch: Dispatch<CartAction>;
  applyLoadSuccess: (response: CartWithFeaturesResponse) => void;
}

export interface IUseCartLifecycleResult {
  createCart: (options: { features?: SearchFeatureResultWithRelevancy[] }) => Promise<void>;
}
