import { act, renderHook, waitFor } from '@testing-library/react';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { CreateDataRequestDialogValues } from 'features/data-request/components/CreateDataRequestDialog';
import { Mock, vi } from 'vitest';
import { useSearchResultDataRequest } from './useSearchResultDataRequest';

vi.mock('hooks/useApi');
vi.mock('hooks/useAuthStateContext');
vi.mock('hooks/useContext');

const mockCreateDataRequest = vi.fn();
const mockSetSnackbar = vi.fn();
const mockSigninRedirect = vi.fn();

const setupAuth = (isAuthenticated: boolean) => {
  (useAuthStateContext as Mock).mockReturnValue({
    auth: { isAuthenticated, signinRedirect: mockSigninRedirect }
  });
};

const expressionTree: ExpressionTreeExpression = {
  type: 'expression',
  operator: 'AND',
  clauses: [
    {
      type: 'predicate',
      feature_property_id: 10,
      feature_type_property_id: null,
      operator: 'ILike',
      value: 'salmon'
    }
  ]
};

const payload: CreateDataRequestDialogValues = {
  reason: 'needed for analysis',
  system_user_ids: [7, 11]
};

describe('useSearchResultDataRequest', () => {
  beforeEach(() => {
    mockCreateDataRequest.mockResolvedValue({});

    (useApi as Mock).mockReturnValue({
      dataRequest: {
        createDataRequest: mockCreateDataRequest
      }
    });

    (useDialogContext as Mock).mockReturnValue({
      setSnackbar: mockSetSnackbar
    });

    setupAuth(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('H1: opens the dialog without calling the API or redirecting (authenticated)', () => {
    setupAuth(true);

    const { result } = renderHook(() => useSearchResultDataRequest({ featureType: 'observation', expressionTree }));

    expect(result.current.isCreateDataRequestDialogOpen).toBe(false);

    act(() => {
      result.current.handleOpenCreateDataRequest();
    });

    expect(result.current.isCreateDataRequestDialogOpen).toBe(true);
    expect(mockCreateDataRequest).not.toHaveBeenCalled();
    expect(mockSigninRedirect).not.toHaveBeenCalled();
  });

  it('H1b: unauthenticated open redirects to login preserving the search location and does not open the dialog', () => {
    setupAuth(false);

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'https://biohub.example',
        pathname: '/search/species_observation',
        search: '?expr=eyJhYmMiOjF9&page=2'
      }
    });

    try {
      const { result } = renderHook(() => useSearchResultDataRequest({ featureType: 'observation', expressionTree }));

      act(() => {
        result.current.handleOpenCreateDataRequest();
      });

      expect(result.current.isCreateDataRequestDialogOpen).toBe(false);
      expect(mockCreateDataRequest).not.toHaveBeenCalled();
      expect(mockSigninRedirect).toHaveBeenCalledTimes(1);
      // The return location travels via the OIDC `state` param (a relative path), not a dynamic
      // redirect_uri — prod SSO rejects wildcard redirect URIs.
      expect(mockSigninRedirect).toHaveBeenCalledWith({
        state: { returnTo: '/search/species_observation?expr=eyJhYmMiOjF9&page=2' }
      });
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    }
  });

  it('H2: closes the dialog when featureType changes', () => {
    const { result, rerender } = renderHook(
      ({ featureType }) => useSearchResultDataRequest({ featureType, expressionTree }),
      { initialProps: { featureType: 'observation' } }
    );

    act(() => {
      result.current.handleOpenCreateDataRequest();
    });
    expect(result.current.isCreateDataRequestDialogOpen).toBe(true);

    rerender({ featureType: 'telemetry' });

    expect(result.current.isCreateDataRequestDialogOpen).toBe(false);
  });

  it('H3: submits featureTypes and the current expressionTree to the API', async () => {
    const { result } = renderHook(() => useSearchResultDataRequest({ featureType: 'observation', expressionTree }));

    await act(async () => {
      await result.current.handleCreateDataRequest(payload);
    });

    expect(mockCreateDataRequest).toHaveBeenCalledTimes(1);
    expect(mockCreateDataRequest).toHaveBeenCalledWith({
      reason: 'needed for analysis',
      system_user_ids: [7, 11],
      featureTypes: ['observation'],
      expression: expressionTree
    });
  });

  it('H4: preserves a literal null expression when expressionTree is null', async () => {
    const { result } = renderHook(() =>
      useSearchResultDataRequest({ featureType: 'observation', expressionTree: null })
    );

    await act(async () => {
      await result.current.handleCreateDataRequest(payload);
    });

    expect(mockCreateDataRequest).toHaveBeenCalledTimes(1);
    const sentPayload = mockCreateDataRequest.mock.calls[0][0];
    expect(sentPayload.expression).toBeNull();
    expect(sentPayload).toEqual(
      expect.objectContaining({
        featureTypes: ['observation'],
        expression: null
      })
    );
  });

  it('H5: on success closes the dialog, shows a success snackbar, and resets submitting state', async () => {
    const { result } = renderHook(() => useSearchResultDataRequest({ featureType: 'observation', expressionTree }));

    act(() => {
      result.current.handleOpenCreateDataRequest();
    });
    expect(result.current.isCreateDataRequestDialogOpen).toBe(true);

    await act(async () => {
      await result.current.handleCreateDataRequest(payload);
    });

    expect(result.current.isCreateDataRequestDialogOpen).toBe(false);
    expect(result.current.isSubmittingDataRequest).toBe(false);
    expect(mockSetSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        snackbarMessage: 'Data request created'
      })
    );
  });

  it('H6: on API rejection keeps the dialog open, shows the server error, and resets submitting state', async () => {
    mockCreateDataRequest.mockRejectedValueOnce({ message: 'quota exceeded' } as APIError);

    const { result } = renderHook(() => useSearchResultDataRequest({ featureType: 'observation', expressionTree }));

    act(() => {
      result.current.handleOpenCreateDataRequest();
    });
    expect(result.current.isCreateDataRequestDialogOpen).toBe(true);

    await act(async () => {
      await result.current.handleCreateDataRequest(payload);
    });

    expect(result.current.isCreateDataRequestDialogOpen).toBe(true);
    expect(result.current.isSubmittingDataRequest).toBe(false);
    expect(mockSetSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        snackbarMessage: 'quota exceeded'
      })
    );
  });

  it('H7: suppresses double-submit while a submission is in flight', async () => {
    let resolveCreate: (() => void) | undefined;
    mockCreateDataRequest.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = () => resolve();
        })
    );

    const { result } = renderHook(() => useSearchResultDataRequest({ featureType: 'observation', expressionTree }));

    let firstSubmit: Promise<void> | undefined;
    let secondSubmit: Promise<void> | undefined;

    act(() => {
      firstSubmit = result.current.handleCreateDataRequest(payload) as Promise<void>;
      secondSubmit = result.current.handleCreateDataRequest(payload) as Promise<void>;
    });

    expect(mockCreateDataRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate?.();
      await firstSubmit;
      await secondSubmit;
    });

    expect(mockCreateDataRequest).toHaveBeenCalledTimes(1);
  });

  it('H8: cancel closes the dialog without calling the API', () => {
    const { result } = renderHook(() => useSearchResultDataRequest({ featureType: 'observation', expressionTree }));

    act(() => {
      result.current.handleOpenCreateDataRequest();
    });
    expect(result.current.isCreateDataRequestDialogOpen).toBe(true);

    act(() => {
      result.current.handleCancelCreateDataRequest();
    });

    expect(result.current.isCreateDataRequestDialogOpen).toBe(false);
    expect(mockCreateDataRequest).not.toHaveBeenCalled();
  });

  it('H9: does not touch state after unmount when the API resolves late', async () => {
    let resolveCreate: (() => void) | undefined;
    mockCreateDataRequest.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = () => resolve();
        })
    );

    const { result, unmount } = renderHook(() =>
      useSearchResultDataRequest({ featureType: 'observation', expressionTree })
    );

    let submitPromise: Promise<void> | undefined;
    act(() => {
      submitPromise = result.current.handleCreateDataRequest(payload) as Promise<void>;
    });

    await waitFor(() => {
      expect(mockCreateDataRequest).toHaveBeenCalledTimes(1);
    });

    unmount();

    await act(async () => {
      resolveCreate?.();
      await submitPromise;
    });

    expect(mockSetSnackbar).not.toHaveBeenCalled();
  });
});
