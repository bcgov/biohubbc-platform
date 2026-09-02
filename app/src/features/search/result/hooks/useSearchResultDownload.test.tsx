import { act, renderHook } from '@testing-library/react';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ApiPaginationResponseParams } from 'types/pagination';
import { Mock, vi } from 'vitest';
import { ICreateDownloadFormValues } from '../sidebar/download/CreateDownloadForm';
import { useSearchResultDownload } from './useSearchResultDownload';

vi.mock('hooks/useApi');
vi.mock('hooks/useContext');

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockCreateDownload = vi.fn();
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
  description: 'a description'
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

    (useDialogContext as Mock).mockReturnValue({
      setSnackbar: mockSetSnackbar,
      setOkDialog: mockSetOkDialog
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('H1: success navigates to the download page without dialog or snackbar', async () => {
    const { result } = renderHook(() =>
      useSearchResultDownload({ featureType: 'observation', expressionTree, isLoading: false, pagination })
    );

    await act(async () => {
      await result.current.handleCreateDownload(formValues);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/download/download-uuid');
    expect(result.current.downloadView).toBe('Downloads');
    expect(mockSetSnackbar).not.toHaveBeenCalled();
    expect(result.current.isCreateDownloadDialogOpen).toBe(false);
    expect(mockSetOkDialog).not.toHaveBeenCalled();
    expect(mockCreateDownload).toHaveBeenCalledWith({
      name: 'My download',
      description: 'a description',
      expression: expressionTree
    });
  });

  it('H2: success navigates regardless of auth-state-specific response fields', async () => {
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

    expect(mockNavigate).toHaveBeenCalledWith('/download/download-uuid');
    expect(mockSetOkDialog).not.toHaveBeenCalled();
    expect(mockSetSnackbar).not.toHaveBeenCalled();
    expect(result.current.downloadView).toBe('Downloads');
    expect(result.current.isCreateDownloadDialogOpen).toBe(false);
  });

  it('H3: failure shows the error snackbar and keeps the create dialog open', async () => {
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

  it('H4: failure shows the error snackbar and keeps the create dialog open after another failed submission', async () => {
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
