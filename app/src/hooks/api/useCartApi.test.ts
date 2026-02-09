import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { CartFeatureListResponse, CartWithFeaturesResponse } from 'interfaces/useCartApi.interface';
import { useCartApi } from './useCartApi';

describe('useCartApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('getCartById', () => {
    it('returns cart features with pagination', async () => {
      const mockResponse: CartFeatureListResponse = {
        features: [],
        pagination: {
          total: 0,
          current_page: 1,
          last_page: 1,
          per_page: 10
        }
      };

      mock.onGet('/api/cart/123/feature').reply(200, mockResponse);

      const result = await useCartApi(axios).getCartById('123');

      expect(result).toEqual(mockResponse);
    });

    it('passes query params for pagination', async () => {
      const mockResponse: CartFeatureListResponse = {
        features: [],
        pagination: {
          total: 0,
          current_page: 2,
          last_page: 1,
          per_page: 20
        }
      };

      mock.onGet('/api/cart/123/feature').reply(200, mockResponse);

      const result = await useCartApi(axios).getCartById('123', { page: 2, limit: 20 });

      expect(result.pagination.current_page).toEqual(2);
    });
  });

  describe('addCartFeatures', () => {
    it('adds features to the cart', async () => {
      const cartId = '123';
      const featuresData = { feature_id: 1 };
      const mockResponse: CartFeatureListResponse = {
        features: [
          {
            cart_submission_feature_id: '1',
            submission_feature_id: 1,
            submission_id: 101,
            feature_type_id: 1,
            feature_type_name: 'Feature Type 1',
            secured: false
          }
        ],
        pagination: {
          total: 1,
          current_page: 1,
          last_page: 1,
          per_page: 10
        }
      };

      mock.onPost('/api/cart/123/feature').reply(200, mockResponse);

      const result = await useCartApi(axios).addCartFeatures(cartId, featuresData);

      expect(result.features.length).toBe(1);
      expect(result.features[0].feature_type_name).toEqual('Feature Type 1');
    });
  });

  describe('removeCartFeatureById', () => {
    it('removes a feature from the cart', async () => {
      const cartId = '123';
      const featureId = '1';
      const mockResponse: CartFeatureListResponse = {
        features: [],
        pagination: {
          total: 0,
          current_page: 1,
          last_page: 1,
          per_page: 10
        }
      };

      mock.onDelete('/api/cart/123/feature/1').reply(200, mockResponse);

      const result = await useCartApi(axios).removeCartFeatureById(cartId, featureId);

      expect(result.features.length).toBe(0);
    });
  });

  describe('clearCart', () => {
    it('clears all features from the cart', async () => {
      const cartId = '123';
      const mockResponse: CartFeatureListResponse = {
        features: [],
        pagination: {
          total: 0,
          current_page: 1,
          last_page: 1,
          per_page: 10
        }
      };

      mock.onDelete('/api/cart/123/feature').reply(200, mockResponse);

      const result = await useCartApi(axios).clearCart(cartId);

      expect(result.features.length).toBe(0);
    });
  });

  describe('createCart', () => {
    it('creates a new cart', async () => {
      const newCartData = { system_user_id: 1, cart_status: 'active' };
      const mockResponse: CartWithFeaturesResponse = {
        cart: {
          cart_id: '123',
          system_user_id: 1,
          cart_status: 'active'
        },
        features: [],
        pagination: {
          total: 0,
          current_page: 1,
          last_page: 1,
          per_page: 10
        }
      };

      mock.onPost('/api/cart').reply(201, mockResponse);

      const result = await useCartApi(axios).createCart(newCartData);

      expect(result.cart.cart_id).toEqual('123');
    });
  });

  describe('assignCartToCurrentUser', () => {
    it('assigns a cart to the current user', async () => {
      const cartId = '123';
      mock.onPut(`/api/cart/${cartId}`).reply(200);

      await expect(useCartApi(axios).assignCartToCurrentUser(cartId)).resolves.toBeUndefined();
    });
  });
});
