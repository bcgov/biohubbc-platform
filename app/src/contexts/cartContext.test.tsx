import { waitFor } from '@testing-library/react';
import { CartSubmissionFeature } from 'interfaces/useCartApi.interface';
import { getMockAuthState, SystemUserAuthState, UnauthenticatedUserAuthState } from 'test-helpers/auth-helpers';
import { createMockCartFeaturesResponse, createMockFeature, createMockSearchFeature } from 'test-helpers/cart-helpers';
import { act, cleanup, render } from 'test-helpers/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStateContext } from './authStateContext';
import { CartContext, CartContextProvider } from './cartContext';
import { ICartContext } from './cartContext.interface';

const { mockCartApi, mockUseApi, mockSetStoredCartId, getStoredCartId, setStoredCartId } = vi.hoisted(() => {
  const cartApi = {
    getCartById: vi.fn(),
    createCart: vi.fn(),
    addCartFeatures: vi.fn(),
    removeCartFeatureById: vi.fn(),
    clearCart: vi.fn(),
    assignCartToCurrentUser: vi.fn()
  };

  const useApi = vi.fn(() => ({ cart: cartApi }));
  const setStorage = vi.fn();
  let storedCartId: string | null = null;

  return {
    mockCartApi: cartApi,
    mockUseApi: useApi,
    mockSetStoredCartId: setStorage,
    getStoredCartId: () => storedCartId,
    setStoredCartId: (value: string | null) => {
      storedCartId = value;
    }
  };
});

vi.mock('hooks/useApi', () => ({
  useApi: () => mockUseApi()
}));

vi.mock('hooks/useSessionStorage', () => ({
  useSessionStorage: () => [getStoredCartId(), mockSetStoredCartId]
}));

const defaultPagination = {
  total: 0,
  current_page: 1,
  last_page: 1,
  per_page: 10
};

const buildCartResponse = (cartId: string, features: CartSubmissionFeature[] = []) => {
  return createMockCartFeaturesResponse(cartId, features, {
    ...defaultPagination,
    total: features.length
  });
};

const makeApiError = (status: number, message = 'api error') => ({ status, message });

type ProviderHarness = {
  getContext: () => ICartContext;
};

const renderProvider = async (authState: ReturnType<typeof getMockAuthState>): Promise<ProviderHarness> => {
  let latestContext: ICartContext | undefined;

  render(
    <AuthStateContext.Provider value={authState}>
      <CartContextProvider>
        <CartContext.Consumer>
          {(value) => {
            latestContext = value;
            return null;
          }}
        </CartContext.Consumer>
      </CartContextProvider>
    </AuthStateContext.Provider>
  );

  await waitFor(() => {
    expect(latestContext).toBeDefined();
  });

  return {
    getContext: () => {
      if (!latestContext) {
        throw new Error('Cart context is unavailable');
      }

      return latestContext;
    }
  };
};

describe('CartContextProvider', () => {
  beforeEach(() => {
    cleanup();
    setStoredCartId(null);
    vi.clearAllMocks();

    mockCartApi.getCartById.mockResolvedValue(buildCartResponse('default-cart', []));
    mockCartApi.createCart.mockResolvedValue(buildCartResponse('created-cart', []));
    mockCartApi.addCartFeatures.mockResolvedValue(buildCartResponse('default-cart', []));
    mockCartApi.removeCartFeatureById.mockResolvedValue(buildCartResponse('default-cart', []));
    mockCartApi.clearCart.mockResolvedValue(buildCartResponse('default-cart', []));
    mockCartApi.assignCartToCurrentUser.mockResolvedValue(undefined);
  });

  it('initializes with an empty cart when no stored cart id exists', async () => {
    const { getContext } = await renderProvider(getMockAuthState({ base: UnauthenticatedUserAuthState }));

    await waitFor(() => {
      expect(getContext().features).toEqual([]);
      expect(getContext().pagination).toEqual({ total: 0, current_page: 1, last_page: 1 });
      expect(getContext().error).toBeUndefined();
    });

    expect(mockCartApi.getCartById).not.toHaveBeenCalled();
    expect(mockCartApi.assignCartToCurrentUser).not.toHaveBeenCalled();
  });

  it('loads cart features from API when a stored cart id exists', async () => {
    const existingFeature = createMockFeature('persisted-1', 10, 110, 210, 'Loaded Feature');
    setStoredCartId('cart-1');
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('cart-1', [existingFeature]));

    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await waitFor(() => {
      expect(mockCartApi.getCartById).toHaveBeenCalledWith('cart-1');
      expect(getContext().features).toEqual([existingFeature]);
      expect(getContext().pagination.total).toBe(1);
    });
  });

  it('stores load errors when getCartById fails', async () => {
    const loadError = new Error('load failed');
    setStoredCartId('cart-err');
    mockCartApi.getCartById.mockRejectedValueOnce(loadError);

    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await waitFor(() => {
      expect(getContext().error).toBe(loadError);
      expect(getContext().isLoading).toBe(false);
    });
  });

  it('creates a cart when adding features with no existing cart', async () => {
    const searchFeature = createMockSearchFeature(1, 'Feature 1');
    const createdFeature = createMockFeature('saved-1', 1, 123, 456, 'Feature 1');
    mockCartApi.createCart.mockResolvedValueOnce(buildCartResponse('new-cart', [createdFeature]));
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('new-cart', [createdFeature]));

    const { getContext } = await renderProvider(getMockAuthState({ base: UnauthenticatedUserAuthState }));

    await act(async () => {
      await getContext().addToCart([searchFeature]);
    });

    expect(mockCartApi.createCart).toHaveBeenCalledTimes(1);
    expect(mockCartApi.createCart).toHaveBeenCalledWith({ features: [1] });
    expect(mockSetStoredCartId).toHaveBeenCalledWith('new-cart');

    await waitFor(() => {
      expect(getContext().features).toHaveLength(1);
      expect(getContext().pagination.total).toBe(1);
    });
  });

  it('adds only non-duplicate features to an existing cart', async () => {
    const persistedFeature = createMockFeature('saved-1', 1, 101, 201, 'Existing');
    const duplicateSearchFeature = createMockSearchFeature(1, 'Existing');
    const newSearchFeature = createMockSearchFeature(2, 'New');
    const updatedPersistedFeature = createMockFeature('saved-2', 2, 102, 202, 'New');

    setStoredCartId('cart-1');
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('cart-1', [persistedFeature]));
    mockCartApi.addCartFeatures.mockResolvedValueOnce(
      buildCartResponse('cart-1', [persistedFeature, updatedPersistedFeature])
    );

    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await waitFor(() => {
      expect(getContext().features).toEqual([persistedFeature]);
    });

    await act(async () => {
      await getContext().addToCart([duplicateSearchFeature, newSearchFeature]);
    });

    expect(mockCartApi.addCartFeatures).toHaveBeenCalledTimes(1);
    expect(mockCartApi.addCartFeatures).toHaveBeenCalledWith('cart-1', { features: [2] }, { page: 1, limit: 2 });

    await waitFor(() => {
      expect(getContext().features).toEqual([persistedFeature, updatedPersistedFeature]);
      expect(getContext().pagination.total).toBe(2);
    });
  });

  it('skips API call when all added features already exist in cart', async () => {
    const persistedFeature = createMockFeature('saved-1', 7, 107, 207, 'Existing');

    setStoredCartId('cart-1');
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('cart-1', [persistedFeature]));

    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await waitFor(() => {
      expect(getContext().features).toEqual([persistedFeature]);
    });

    await act(async () => {
      await getContext().addToCart([createMockSearchFeature(7, 'Existing')]);
    });

    expect(mockCartApi.addCartFeatures).not.toHaveBeenCalled();
  });

  it('returns early when addToCart receives an empty feature list', async () => {
    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await act(async () => {
      await getContext().addToCart([]);
    });

    expect(mockCartApi.createCart).not.toHaveBeenCalled();
    expect(mockCartApi.addCartFeatures).not.toHaveBeenCalled();
  });

  it('retries addToCart by creating a new cart on 401/403 add failure', async () => {
    const persistedFeature = createMockFeature('saved-1', 1, 101, 201, 'Existing');
    const newFeature = createMockSearchFeature(2, 'New');

    setStoredCartId('cart-1');
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('cart-1', [persistedFeature]));
    mockCartApi.addCartFeatures.mockRejectedValueOnce(makeApiError(401));
    mockCartApi.createCart.mockResolvedValueOnce(
      buildCartResponse('cart-2', [createMockFeature('saved-2', 2, 102, 202, 'New')])
    );

    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await waitFor(() => {
      expect(getContext().features).toEqual([persistedFeature]);
    });

    await act(async () => {
      await getContext().addToCart([newFeature]);
    });

    expect(mockCartApi.addCartFeatures).toHaveBeenCalledTimes(1);
    expect(mockCartApi.createCart).toHaveBeenCalledTimes(1);
    expect(mockCartApi.createCart).toHaveBeenCalledWith({ features: [2] });
    expect(mockSetStoredCartId).toHaveBeenCalledWith('cart-2');
  });

  it('rolls back addToCart and rethrows when add fails with a non-auth error', async () => {
    const persistedFeature = createMockFeature('saved-1', 1, 101, 201, 'Existing');
    const newFeature = createMockSearchFeature(2, 'New');
    const addError = makeApiError(500);

    setStoredCartId('cart-1');
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('cart-1', [persistedFeature]));
    mockCartApi.addCartFeatures.mockRejectedValueOnce(addError);

    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await waitFor(() => {
      expect(getContext().features).toEqual([persistedFeature]);
    });

    await expect(
      act(async () => {
        await getContext().addToCart([newFeature]);
      })
    ).rejects.toBe(addError);

    await waitFor(() => {
      expect(getContext().features).toEqual([persistedFeature]);
      expect(getContext().pagination.total).toBe(1);
    });
  });

  it('removes persisted features by cart_submission_feature_id', async () => {
    const featureA = createMockFeature('saved-1', 1, 101, 201, 'Feature A');
    const featureB = createMockFeature('saved-2', 2, 102, 202, 'Feature B');

    setStoredCartId('cart-1');
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('cart-1', [featureA, featureB]));
    mockCartApi.removeCartFeatureById.mockResolvedValueOnce(buildCartResponse('cart-1', [featureB]));

    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await waitFor(() => {
      expect(getContext().features).toEqual([featureA, featureB]);
    });

    await act(async () => {
      await getContext().removeFromCart([featureA.submission_feature_id]);
    });

    expect(mockCartApi.removeCartFeatureById).toHaveBeenCalledTimes(1);
    expect(mockCartApi.removeCartFeatureById).toHaveBeenCalledWith('cart-1', 'saved-1', { page: 1, limit: 1 });

    await waitFor(() => {
      expect(getContext().features).toEqual([featureB]);
      expect(getContext().pagination.total).toBe(1);
    });
  });

  it('does not call remove API when requested ids are not persisted in cart state', async () => {
    const persistedFeature = createMockFeature('saved-1', 1, 101, 201, 'Persisted');

    setStoredCartId('cart-1');
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('cart-1', [persistedFeature]));

    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await waitFor(() => {
      expect(getContext().features).toEqual([persistedFeature]);
    });

    await act(async () => {
      await getContext().removeFromCart([999]);
    });

    expect(mockCartApi.removeCartFeatureById).not.toHaveBeenCalled();
    expect(getContext().features).toEqual([persistedFeature]);
  });

  it('returns early when removeFromCart receives an empty id list', async () => {
    const persistedFeature = createMockFeature('saved-1', 1, 101, 201, 'Persisted');
    setStoredCartId('cart-1');
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('cart-1', [persistedFeature]));

    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await act(async () => {
      await getContext().removeFromCart([]);
    });

    expect(mockCartApi.removeCartFeatureById).not.toHaveBeenCalled();
  });

  it('rolls back removeFromCart when API removal fails', async () => {
    const featureA = createMockFeature('saved-1', 1, 101, 201, 'Feature A');
    const featureB = createMockFeature('saved-2', 2, 102, 202, 'Feature B');

    setStoredCartId('cart-1');
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('cart-1', [featureA, featureB]));
    mockCartApi.removeCartFeatureById.mockRejectedValueOnce(new Error('remove failed'));

    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await waitFor(() => {
      expect(getContext().features).toEqual([featureA, featureB]);
    });

    await expect(
      act(async () => {
        await getContext().removeFromCart([featureA.submission_feature_id]);
      })
    ).rejects.toThrow('remove failed');

    await waitFor(() => {
      expect(getContext().features).toEqual([featureA, featureB]);
      expect(getContext().pagination.total).toBe(2);
    });
  });

  it('clears cart with optimistic update and keeps empty result on success', async () => {
    const featureA = createMockFeature('saved-1', 1, 101, 201, 'Feature A');

    setStoredCartId('cart-1');
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('cart-1', [featureA]));
    mockCartApi.clearCart.mockResolvedValueOnce(buildCartResponse('cart-1', []));

    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await waitFor(() => {
      expect(getContext().features).toEqual([featureA]);
    });

    await act(async () => {
      await getContext().clearCart();
    });

    expect(mockCartApi.clearCart).toHaveBeenCalledTimes(1);
    expect(mockCartApi.clearCart).toHaveBeenCalledWith('cart-1', { page: 1, limit: 1 });

    await waitFor(() => {
      expect(getContext().features).toEqual([]);
      expect(getContext().pagination.total).toBe(0);
    });
  });

  it('rolls back clearCart when API clear fails', async () => {
    const featureA = createMockFeature('saved-1', 1, 101, 201, 'Feature A');

    setStoredCartId('cart-1');
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('cart-1', [featureA]));
    mockCartApi.clearCart.mockRejectedValueOnce(new Error('clear failed'));

    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await waitFor(() => {
      expect(getContext().features).toEqual([featureA]);
    });

    await expect(
      act(async () => {
        await getContext().clearCart();
      })
    ).rejects.toThrow('clear failed');

    await waitFor(() => {
      expect(getContext().features).toEqual([featureA]);
      expect(getContext().pagination.total).toBe(1);
    });
  });

  it('returns early when clearCart is called without a cart id', async () => {
    const { getContext } = await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await act(async () => {
      await getContext().clearCart();
    });

    expect(mockCartApi.clearCart).not.toHaveBeenCalled();
  });

  it('assigns stored cart to authenticated users', async () => {
    setStoredCartId('cart-claim');
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('cart-claim', []));

    await renderProvider(getMockAuthState({ base: SystemUserAuthState }));

    await waitFor(() => {
      expect(mockCartApi.assignCartToCurrentUser).toHaveBeenCalledTimes(1);
      expect(mockCartApi.assignCartToCurrentUser).toHaveBeenCalledWith('cart-claim');
    });
  });

  it('does not assign cart when unauthenticated', async () => {
    setStoredCartId('cart-anon');
    mockCartApi.getCartById.mockResolvedValueOnce(buildCartResponse('cart-anon', []));

    await renderProvider(getMockAuthState({ base: UnauthenticatedUserAuthState }));

    await waitFor(() => {
      expect(mockCartApi.assignCartToCurrentUser).not.toHaveBeenCalled();
      expect(mockCartApi.getCartById).toHaveBeenCalledWith('cart-anon');
    });
  });
});
