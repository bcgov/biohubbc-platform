import { fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useCodesContext, useDialogContext } from 'hooks/useContext';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { SearchResultPage } from './SearchResultPage';

const mockNavigate = vi.fn();
const mockUseParams = vi.fn(() => ({ featureType: 'survey' }));
const mockUseLocation = vi.fn(() => ({ search: '', pathname: '/search/survey', hash: '', state: null, key: 'k' }));
const mockSetSearchParams = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
    useLocation: () => mockUseLocation(),
    useSearchParams: () => [mockSearchParams, mockSetSearchParams]
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('hooks/useApi');
vi.mock('hooks/useAuthStateContext');
vi.mock('hooks/useContext');
vi.mock('./hooks/useSearchResults');
// The map layout owns its own tile session and renders MapLibre; the page test only cares that it is handed the
// current search, so it is replaced with a marker.
vi.mock('./layout/map/SearchResultMapLayout', () => ({
  SearchResultMapLayout: (props: { featureTypeName: string }) => (
    <div data-testid="search-result-map-layout" data-feature-type={props.featureTypeName} />
  )
}));
vi.mock('./header/SearchResultSearch', () => ({
  SearchResultSearch: ({ onExpressionApply }: { onExpressionApply: (expressionTree: unknown) => void }) => (
    <>
      <button
        type="button"
        onClick={() =>
          onExpressionApply({
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
          })
        }>
        Apply expression
      </button>
      <button type="button" onClick={() => onExpressionApply(null)}>
        Apply empty expression
      </button>
    </>
  )
}));

import { useSearchResults } from './hooks/useSearchResults';

const mockUseApi = useApi as Mock;
const mockUseAuthStateContext = useAuthStateContext as Mock;
const mockUseCodesContext = useCodesContext as Mock;
const mockUseDialogContext = useDialogContext as Mock;
const mockUseSearchResults = useSearchResults as Mock;

const mockCreateDownload = vi.fn();
const mockCreateDataRequest = vi.fn();
const mockGetAvailableUsers = vi.fn();
const mockSetSnackbar = vi.fn();
const mockSetOkDialog = vi.fn();
const mockSetResultSearchParams = vi.fn();

const codesPayload = {
  feature_type_with_properties: [
    { feature_type: { name: 'survey', display_name: 'Survey' }, properties: [] },
    { feature_type: { name: 'telemetry', display_name: 'Telemetry' }, properties: [] }
  ]
};

const renderPage = () => render(<SearchResultPage />);

describe('SearchResultPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset location to default (no search params) before each test.
    mockUseLocation.mockReturnValue({ search: '', pathname: '/search/survey', hash: '', state: null, key: 'k' });

    // Mirror navigate calls into useLocation so URL-derived state (e.g. the `expr` param)
    // is visible on subsequent renders, matching real router behaviour.
    mockNavigate.mockImplementation((to: unknown) => {
      if (to && typeof to === 'object' && 'search' in to) {
        const { pathname = '/search/survey', search = '' } = to as { pathname?: string; search?: string };
        mockUseLocation.mockReturnValue({ search, pathname, hash: '', state: null, key: 'k' });
      }
    });

    mockGetAvailableUsers.mockResolvedValue({ users: [] });
    // Default to authenticated: the create-download tests below assert the authenticated
    // snackbar + Downloads-sidebar path. Anonymous-branch behavior is covered in
    // useSearchResultDownload.test.tsx.
    mockUseAuthStateContext.mockReturnValue({ auth: { isAuthenticated: true } });
    mockUseApi.mockReturnValue({
      download: { createDownload: mockCreateDownload },
      dataRequest: { createDataRequest: mockCreateDataRequest },
      teams: { getAvailableUsers: mockGetAvailableUsers }
    });
    mockUseCodesContext.mockReturnValue({
      codesDataLoader: { isReady: true, data: codesPayload }
    });
    mockUseDialogContext.mockReturnValue({
      setSnackbar: mockSetSnackbar,
      setOkDialog: mockSetOkDialog
    });
    mockUseParams.mockReturnValue({ featureType: 'survey' });
    mockUseSearchResults.mockReturnValue({
      rows: [{ uuid: 'result-1', submission_feature_id: 1 }],
      properties: [],
      isLoading: false,
      searchParams: new URLSearchParams(),
      setSearchParams: mockSetResultSearchParams,
      pagination: { total: 5, current_page: 1, last_page: 1, per_page: 10 }
    });
  });

  it('renders the toolbar with the "Create Download" label (not "Download All")', () => {
    const { getByRole, queryByRole } = renderPage();

    expect(getByRole('button', { name: /create download/i })).toBeInTheDocument();
    expect(queryByRole('button', { name: /^download all$/i })).not.toBeInTheDocument();
  });

  it('updates the result limit when the rows-per-page control changes', () => {
    const { getByRole } = renderPage();

    fireEvent.mouseDown(getByRole('combobox', { name: /rows per page/i }));
    fireEvent.click(getByRole('option', { name: /25/i }));

    expect(mockSetResultSearchParams).toHaveBeenCalledWith({ limit: '25' });
  });

  it('opens an OkDialog when Create Download is clicked with zero results', () => {
    mockUseSearchResults.mockReturnValue({
      rows: [],
      properties: [],
      isLoading: false,
      searchParams: new URLSearchParams(),
      setSearchParams: vi.fn(),
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
    });

    const { getByRole, queryByRole } = renderPage();

    fireEvent.click(getByRole('button', { name: /create download/i }));

    expect(mockSetOkDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        dialogTitle: 'Create Download',
        dialogText: expect.stringMatching(/no features matching/i)
      })
    );
    expect(queryByRole('heading', { level: 2, name: /^create download$/i })).not.toBeInTheDocument();
  });

  it('opens the form dialog when Create Download is clicked with results', async () => {
    const { getByRole, getByLabelText } = renderPage();

    fireEvent.click(getByRole('button', { name: /create download/i }));

    await waitFor(() => {
      expect(getByLabelText(/Name/i)).toBeInTheDocument();
    });
    expect(mockSetOkDialog).not.toHaveBeenCalled();
  });

  it('defaults the download name to feature type plus current timestamp', async () => {
    const { getByRole, getByLabelText, rerender } = renderPage();

    fireEvent.click(getByRole('button', { name: /apply expression/i }));
    rerender(<SearchResultPage />);
    fireEvent.click(getByRole('button', { name: /create download/i }));

    await waitFor(() => expect(getByLabelText(/Name/i)).toBeInTheDocument());

    expect((getByLabelText(/Name/i) as HTMLInputElement).value).toMatch(/^survey - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('submits the create-download dialog with expression: null when no expression is applied', async () => {
    mockCreateDownload.mockResolvedValue({ download_id: 'new-uuid', download_url: 'https://example/new-uuid' });

    const { getByRole, getByLabelText, getByTestId } = renderPage();

    fireEvent.click(getByRole('button', { name: /create download/i }));

    await waitFor(() => expect(getByLabelText(/Name/i)).toBeInTheDocument());

    fireEvent.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => expect(mockCreateDownload).toHaveBeenCalledTimes(1));
    expect(mockCreateDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringMatching(/^survey - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
        expression: null
      })
    );
    expect(mockSetSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        snackbarMessage: expect.stringMatching(/track its progress in the downloads sidebar/i)
      })
    );
  });

  it('does not fire createDownload twice when the save button is double-clicked while in flight', async () => {
    let resolveCreate: (value: { download_id: string; download_url: string }) => void = () => undefined;
    mockCreateDownload.mockImplementation(
      () =>
        new Promise<{ download_id: string; download_url: string }>((resolve) => {
          resolveCreate = resolve;
        })
    );

    const { getByRole, getByLabelText, getByTestId, rerender } = renderPage();

    fireEvent.click(getByRole('button', { name: /apply expression/i }));
    rerender(<SearchResultPage />);
    fireEvent.click(getByRole('button', { name: /create download/i }));
    await waitFor(() => expect(getByLabelText(/Name/i)).toBeInTheDocument());

    const saveButton = getByTestId('edit-dialog-save-button');
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockCreateDownload).toHaveBeenCalledTimes(1));

    resolveCreate({ download_id: 'new-uuid', download_url: 'https://example/new-uuid' });

    await waitFor(() =>
      expect(mockSetSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          snackbarMessage: expect.stringMatching(/track its progress in the downloads sidebar/i)
        })
      )
    );
    expect(mockCreateDownload).toHaveBeenCalledTimes(1);
  });

  it('disables Create Download while pagination is still loading (undefined → not zero)', () => {
    mockUseSearchResults.mockReturnValue({
      rows: [],
      properties: [],
      isLoading: true,
      searchParams: new URLSearchParams(),
      setSearchParams: vi.fn(),
      pagination: undefined
    });

    const { getByRole } = renderPage();

    fireEvent.click(getByRole('button', { name: /create download/i }));

    expect(getByRole('button', { name: /create download/i })).toBeDisabled();
    expect(mockSetOkDialog).not.toHaveBeenCalled();
    expect(mockCreateDownload).not.toHaveBeenCalled();
  });

  it('closes the open create-download dialog when the URL :featureType changes', async () => {
    const { getByRole, getByLabelText, queryByLabelText, rerender } = renderPage();

    fireEvent.click(getByRole('button', { name: /create download/i }));
    await waitFor(() => expect(getByLabelText(/Name/i)).toBeInTheDocument());

    mockUseParams.mockReturnValue({ featureType: 'telemetry' });
    rerender(<SearchResultPage />);

    await waitFor(() => expect(queryByLabelText(/Name/i)).not.toBeInTheDocument());
  });

  it('keeps the applied expression when switching feature type tabs', async () => {
    const { getByRole, rerender } = renderPage();

    fireEvent.click(getByRole('button', { name: /apply expression/i }));
    rerender(<SearchResultPage />);

    await waitFor(() => {
      expect(mockUseSearchResults).toHaveBeenLastCalledWith(
        'survey',
        true,
        expect.objectContaining({
          type: 'expression',
          operator: 'AND'
        }),
        expect.any(Number)
      );
    });

    mockUseParams.mockReturnValue({ featureType: 'telemetry' });
    rerender(<SearchResultPage />);

    await waitFor(() => {
      expect(mockUseSearchResults).toHaveBeenLastCalledWith(
        'telemetry',
        true,
        expect.objectContaining({
          type: 'expression',
          operator: 'AND'
        }),
        expect.any(Number)
      );
    });
  });

  it('refreshes with a null expression when applying no expression filters', async () => {
    const { getByRole, rerender } = renderPage();
    const callCountBeforeApply = mockUseSearchResults.mock.calls.length;

    fireEvent.click(getByRole('button', { name: /apply empty expression/i }));
    rerender(<SearchResultPage />);

    await waitFor(() => {
      expect(mockUseSearchResults.mock.calls.length).toBeGreaterThan(callCountBeforeApply);
      expect(mockUseSearchResults).toHaveBeenLastCalledWith('survey', true, null, expect.any(Number));
    });
  });

  it('surfaces the API error message in a snackbar when submit fails', async () => {
    mockCreateDownload.mockRejectedValue({ message: 'Server exploded' });

    const { getByRole, getByLabelText, getByTestId, rerender } = renderPage();

    fireEvent.click(getByRole('button', { name: /apply expression/i }));
    rerender(<SearchResultPage />);
    fireEvent.click(getByRole('button', { name: /create download/i }));
    await waitFor(() => expect(getByLabelText(/Name/i)).toBeInTheDocument());

    fireEvent.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => expect(mockCreateDownload).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockSetSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          open: true,
          snackbarMessage: 'Server exploded'
        })
      )
    );
  });

  it('P1: hides the secured-results banner when there are no hidden secured matches, even if a visible row is secured', () => {
    // A visible secured row the caller CAN see must not, by itself, surface the banner.
    mockUseSearchResults.mockReturnValue({
      rows: [{ uuid: 'result-1', submission_feature_id: 1, is_secured: true }],
      properties: [],
      hasMoreSecuredFeatures: false,
      isLoading: false,
      searchParams: new URLSearchParams(),
      setSearchParams: vi.fn(),
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });

    const { queryByRole } = renderPage();

    expect(queryByRole('button', { name: /request access/i })).not.toBeInTheDocument();
  });

  it('P2: shows the banner when secured matches are hidden and opens the create-data-request dialog without navigating', async () => {
    mockUseSearchResults.mockReturnValue({
      rows: [{ uuid: 'result-1', submission_feature_id: 1, is_secured: false }],
      properties: [],
      hasMoreSecuredFeatures: true,
      isLoading: false,
      searchParams: new URLSearchParams(),
      setSearchParams: vi.fn(),
      pagination: { total: 2, current_page: 1, last_page: 1, per_page: 10 }
    });

    const { getByRole, findByRole } = renderPage();

    const requestAccessButton = getByRole('button', { name: /request access/i });
    fireEvent.click(requestAccessButton);

    expect(await findByRole('heading', { level: 2, name: /create data request/i })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('P3a: submits the canonical lowercase featureType when the route is mixed-case', async () => {
    mockCreateDataRequest.mockResolvedValue({});
    mockUseParams.mockReturnValue({ featureType: 'SURVEY' });
    mockUseSearchResults.mockReturnValue({
      rows: [{ uuid: 'result-1', submission_feature_id: 1, is_secured: false }],
      properties: [],
      hasMoreSecuredFeatures: true,
      isLoading: false,
      searchParams: new URLSearchParams(),
      setSearchParams: vi.fn(),
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });

    const { getByRole, findByLabelText, getByTestId, findByRole } = renderPage();

    fireEvent.click(getByRole('button', { name: /request access/i }));
    await findByRole('heading', { level: 2, name: /create data request/i });

    fireEvent.change(await findByLabelText(/Reason/i), { target: { value: 'needed for analysis' } });
    fireEvent.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => expect(mockCreateDataRequest).toHaveBeenCalledTimes(1));
    expect(mockCreateDataRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        featureTypes: ['survey']
      })
    );
  });

  it('P4: surfaces an API error and keeps the create-data-request dialog open on failure', async () => {
    mockCreateDataRequest.mockRejectedValue({ message: 'Server exploded' });
    mockUseSearchResults.mockReturnValue({
      rows: [{ uuid: 'result-1', submission_feature_id: 1, is_secured: false }],
      properties: [],
      hasMoreSecuredFeatures: true,
      isLoading: false,
      searchParams: new URLSearchParams(),
      setSearchParams: vi.fn(),
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });

    const { getByRole, findByLabelText, getByTestId, findByRole } = renderPage();

    fireEvent.click(getByRole('button', { name: /request access/i }));
    await findByRole('heading', { level: 2, name: /create data request/i });

    fireEvent.change(await findByLabelText(/Reason/i), { target: { value: 'needed for analysis' } });
    fireEvent.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => expect(mockCreateDataRequest).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockSetSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          open: true,
          snackbarMessage: 'Server exploded'
        })
      )
    );
    expect(getByRole('heading', { level: 2, name: /create data request/i })).toBeInTheDocument();
  });
});
