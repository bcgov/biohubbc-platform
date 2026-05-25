import { act, renderHook } from '@testing-library/react';
import { DOWNLOAD_SIDEBAR_VIEW } from 'constants/download';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useCartContext, useDialogContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ApiPaginationResponseParams } from 'types/pagination';
import { Mock, vi } from 'vitest';
import { ICreateDownloadFormValues } from '../sidebar/download/CreateDownloadForm';
import { useSearchResultDownload } from './useSearchResultDownload';

vi.mock('hooks/useApi');
vi.mock('hooks/useAuthStateContext');
vi.mock('hooks/useContext');

const mockCreateDownload = vi.fn();
const mockCheckout = vi.fn();
const mockSetSnackbar = vi.fn();
const mockSetOkDialog = vi.fn();

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

const pagination: ApiPaginationResponseParams = {
  total: 1,
  current_page: 1,
  last_page: 1
};

const formValues: ICreateDownloadFormValues = {
  name: 'My download',
  description: 'a description',
  featureTypes: ['observation']
};

const setupAuth = (isAuthenticated: boolean) => {
  (useAuthStateContext as Mock).mockReturnValue({
    auth: { isAuthenticated }
  });
};

describe('useSearchResultDownload', () => {
  beforeEach(() => {
    mockCreateDownload.mockResolvedValue({
      download_id: 'download-uuid',
      download_url: 'http://localhost/api/download/download-uuid',
      export_id: null,
      export_url: null
    });

    (useApi as Mock).mockReturnValue({
      download: {
        createDownload: mockCreateDownload
      }
    });

    (useCartContext as Mock).mockReturnValue({
      checkout: mockCheckout
    });

    (useDialogContext as Mock).mockReturnValue({
      setSnackbar: mockSetSnackbar,
      setOkDialog: mockSetOkDialog
    });

    setupAuth(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('H1: authenticated success switches to the Downloads view and shows the success snackbar', async () => {
    setupAuth(true);

    const { result } = renderHook(() =>
      useSearchResultDownload({ featureType: 'observation', expressionTree, isLoading: false, pagination })
    );

    await act(async () => {
      await result.current.handleCreateDownload(formValues);
    });

    expect(result.current.downloadView).toBe(DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS);
    expect(mockSetSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        snackbarMessage: 'Download created. Track its progress in the Downloads sidebar.'
      })
    );
    expect(result.current.isCreateDownloadDialogOpen).toBe(false);
    expect(mockSetOkDialog).not.toHaveBeenCalled();
  });

  it('H2: anonymous success opens a persistent OK dialog and does not switch view or snackbar', async () => {
    setupAuth(false);
    mockCreateDownload.mockResolvedValueOnce({
      download_id: 'download-uuid',
      download_url: 'http://localhost/api/download/download-uuid',
      export_id: 'export-uuid',
      export_url: 'http://localhost/api/download-export/export-uuid'
    });

    const { result } = renderHook(() =>
      useSearchResultDownload({ featureType: 'observation', expressionTree, isLoading: false, pagination })
    );

    await act(async () => {
      await result.current.handleCreateDownload(formValues);
    });

    expect(mockSetOkDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        dialogTitle: 'Download created'
      })
    );
    expect(result.current.downloadView).not.toBe(DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS);
    expect(mockSetSnackbar).not.toHaveBeenCalled();
    expect(result.current.isCreateDownloadDialogOpen).toBe(false);
  });

  it('H3: failure shows the error snackbar and keeps the create dialog open (authenticated)', async () => {
    setupAuth(true);
    mockCreateDownload.mockRejectedValueOnce({ message: 'quota exceeded' } as APIError);

    const { result } = renderHook(() =>
      useSearchResultDownload({ featureType: 'observation', expressionTree, isLoading: false, pagination })
    );

    act(() => {
      result.current.handleOpenCreateDownload();
    });
    expect(result.current.isCreateDownloadDialogOpen).toBe(true);

    await act(async () => {
      await result.current.handleCreateDownload(formValues);
    });

    expect(result.current.isCreateDownloadDialogOpen).toBe(true);
    expect(mockSetSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        snackbarMessage: 'quota exceeded'
      })
    );
    expect(mockSetOkDialog).not.toHaveBeenCalled();
  });

  it('H4: failure shows the error snackbar and keeps the create dialog open (anonymous)', async () => {
    setupAuth(false);
    mockCreateDownload.mockRejectedValueOnce({ message: 'server unavailable' } as APIError);

    const { result } = renderHook(() =>
      useSearchResultDownload({ featureType: 'observation', expressionTree, isLoading: false, pagination })
    );

    act(() => {
      result.current.handleOpenCreateDownload();
    });
    expect(result.current.isCreateDownloadDialogOpen).toBe(true);

    await act(async () => {
      await result.current.handleCreateDownload(formValues);
    });

    expect(result.current.isCreateDownloadDialogOpen).toBe(true);
    expect(mockSetSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        snackbarMessage: 'server unavailable'
      })
    );
    expect(mockSetOkDialog).not.toHaveBeenCalled();
  });
});
