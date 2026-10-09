import { AxiosError } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SubmissionsRouter } from 'router/admin/submission/SubmissionRouter';
import { fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';

// Keep DOM routing and shared query hooks on the same router module in Vitest.
vi.mock('react-router-dom', () => vi.importActual('react-router'));

const mocks = vi.hoisted(() => ({
  mapMounts: vi.fn(),
  getSubmission: vi.fn(),
  listFeatureTypes: vi.fn(),
  getFeatureTypeProperties: vi.fn(),
  listErrors: vi.fn(),
  getUploadBlueprint: vi.fn()
}));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    submissions: { getSubmissionRecordWithSecurity: mocks.getSubmission },
    admin: {
      listSubmissionUploadFeatureTypes: mocks.listFeatureTypes,
      getSubmissionUploadFeatureTypeProperties: mocks.getFeatureTypeProperties,
      listSubmissionFeatureErrors: mocks.listErrors,
      getSubmissionUploadBlueprint: mocks.getUploadBlueprint
    }
  })
}));
// The map owns its own tile session and is exercised by its own suite; here we only check what it is asked to map.
vi.mock('features/admin/reviews/components/map/SubmissionUploadMap', async () => {
  const { useEffect } = await import('react');
  return {
    SubmissionUploadMap: (props: { submissionId: number; submissionUploadId: string; reconciliation?: string }) => {
      useEffect(() => {
        mocks.mapMounts();
      }, []);
      return (
        <div
          data-testid="upload-map"
          data-submission-id={props.submissionId}
          data-upload-id={props.submissionUploadId}
          data-reconciliation={props.reconciliation}
        />
      );
    }
  };
});
vi.mock('features/admin/dashboard/DashboardPage', () => ({ default: () => null }));
vi.mock('features/submissions/create/CreateSubmissionPage', () => ({ CreateSubmissionPage: () => null }));

const uploadId = '14cac655-eb06-450a-bee9-d05bd97ecc9b';
const scope = { submissionId: 31, submissionUploadId: uploadId };
const path = `/admin/submissions/31/uploads/${uploadId}`;
const blueprint = {
  blueprint_id: 1,
  name: 'Wildlife',
  version_number: 1,
  description: null,
  is_default: true,
  parent_blueprint_id: null,
  record_effective_date: '2026-01-01',
  record_end_date: null
};

/**
 * Build the not-found error the API returns for an upload outside the submission.
 * @returns {AxiosError} A 404 response error.
 */
const notFoundError = () => {
  const error = new AxiosError('Not found');
  error.response = { status: 404 } as AxiosError['response'];
  return error;
};

/**
 * Exercise the actual submissions router at an upload URL.
 * @param {string} location Initial route and optional query parameters.
 * @returns Rendered route tree.
 */
const renderAt = (location = path) =>
  render(
    <MemoryRouter initialEntries={[location]}>
      <Routes>
        <Route path="/admin/submissions/*" element={<SubmissionsRouter />} />
        <Route path="/page-not-found" element={<div>Not found</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('AdminSubmissionUploadPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSubmission.mockResolvedValue({ name: 'Wildlife survey', description: 'Submitted wildlife observations' });
    mocks.listFeatureTypes.mockResolvedValue({
      feature_types: [
        { feature_type_name: 'animal', count: 12 },
        { feature_type_name: 'survey', count: 1 }
      ],
      pagination: { total: 2, current_page: 1, last_page: 1, per_page: 10 }
    });
    mocks.getFeatureTypeProperties.mockResolvedValue({
      properties: [{ feature_property_id: 1, name: 'name', display_name: 'Name', type_name: 'string' }]
    });
    mocks.listErrors.mockResolvedValue({
      errors: [
        {
          submission_feature_error_id: 5,
          error_code: 'invalid_type',
          error_message: 'Value is not a number',
          feature_type_name: 'animal',
          property_name: 'count',
          count: 42
        }
      ],
      pagination: { total: 11, current_page: 1, last_page: 2, per_page: 10 }
    });
    mocks.getUploadBlueprint.mockResolvedValue(blueprint);
  });

  it('resolves the upload route with its header, outcome tabs, feature types and map', async () => {
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Wildlife survey' })).toBeVisible();
    expect(screen.getByText('Submitted wildlife observations')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Wildlife survey' })).toHaveAttribute('href', '/admin/submissions/31');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'New',
      'Unchanged',
      'Changed',
      'Errors',
      'Metadata'
    ]);
    expect(await screen.findByRole('columnheader', { name: 'Feature type' })).toBeVisible();
    const animalRow = screen.getByRole('gridcell', { name: 'Animal' }).closest('[role="row"]') as HTMLElement;
    expect(within(animalRow).getByRole('gridcell', { name: '12' })).toBeVisible();
    expect(screen.getByRole('gridcell', { name: 'Survey' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Map' })).toBeVisible();
    expect(screen.getByTestId('upload-map')).toHaveAttribute('data-submission-id', '31');
    expect(screen.getByTestId('upload-map')).toHaveAttribute('data-upload-id', uploadId);
  });

  it.each([
    ['', 'New', 'new'],
    ['?tab=new', 'New', 'new'],
    ['?tab=unchanged', 'Unchanged', 'unmodified'],
    ['?tab=changed', 'Changed', 'modified'],
    ['?tab=invalid', 'New', 'new']
  ])('passes the outcome for "%s" to the feature types table and the map', async (search, label, reconciliation) => {
    renderAt(`${path}${search}`);
    expect(await screen.findByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('gridcell', { name: 'Animal' })).toBeVisible();
    expect(mocks.listFeatureTypes).toHaveBeenCalledTimes(1);
    expect(mocks.listFeatureTypes).toHaveBeenCalledWith(
      { ...scope, reconciliation },
      { reconciliation },
      { page: 1, limit: 10, sort: 'feature_type_name', order: 'asc' },
      { signal: expect.any(AbortSignal) }
    );
    expect(screen.getByTestId('upload-map')).toHaveAttribute('data-reconciliation', reconciliation);
  });

  it('changes the feature types and the mapped outcome when another outcome tab is selected', async () => {
    mocks.listFeatureTypes.mockImplementation(async ({ reconciliation }) => ({
      feature_types: [{ feature_type_name: reconciliation === 'modified' ? 'habitat' : 'animal', count: 1 }],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    }));
    renderAt();
    expect(await screen.findByRole('gridcell', { name: 'Animal' })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Changed' }));
    expect(await screen.findByRole('gridcell', { name: 'Habitat' })).toBeVisible();
    expect(screen.queryByRole('gridcell', { name: 'Animal' })).not.toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: 'Changed' })).toBeVisible();
    expect(screen.getByTestId('upload-map')).toHaveAttribute('data-reconciliation', 'modified');
    expect(mocks.getSubmission).toHaveBeenCalledTimes(1);
  });

  it('keeps the feature types grid and the map mounted across outcome tabs and behind the Metadata tab', async () => {
    renderAt();
    await screen.findByRole('gridcell', { name: 'Animal' });
    const grid = screen.getByRole('grid');
    const map = screen.getByTestId('upload-map');

    fireEvent.click(screen.getByRole('tab', { name: 'Changed' }));
    await waitFor(() => expect(map).toHaveAttribute('data-reconciliation', 'modified'));
    // While the next outcome loads the grid shows its own loading state rather than being replaced.
    expect(screen.getByRole('grid')).toBe(grid);
    await screen.findByRole('gridcell', { name: 'Animal' });

    fireEvent.click(screen.getByRole('tab', { name: 'Metadata' }));
    expect(await screen.findByRole('gridcell', { name: uploadId })).toBeVisible();
    expect(map).not.toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'Unchanged' }));
    await waitFor(() => expect(map).toBeVisible());
    expect(map).toHaveAttribute('data-reconciliation', 'unmodified');
    expect(screen.getByTestId('upload-map')).toBe(map);
    expect(mocks.mapMounts).toHaveBeenCalledTimes(1);
  });

  it('pages feature types on the server and returns to the first page for another outcome', async () => {
    mocks.listFeatureTypes.mockImplementation(async (_scope, _filters, pagination) => ({
      feature_types: [{ feature_type_name: pagination.page === 2 ? 'habitat' : 'animal', count: 1 }],
      pagination: { total: 12, current_page: pagination.page, last_page: 2, per_page: 10 }
    }));
    renderAt();
    await screen.findByRole('gridcell', { name: 'Animal' });
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(await screen.findByRole('gridcell', { name: 'Habitat' })).toBeVisible();
    expect(mocks.listFeatureTypes).toHaveBeenLastCalledWith(
      { ...scope, reconciliation: 'new' },
      { reconciliation: 'new' },
      expect.objectContaining({ page: 2, limit: 10 }),
      { signal: expect.any(AbortSignal) }
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Changed' }));
    await waitFor(() =>
      expect(mocks.listFeatureTypes).toHaveBeenLastCalledWith(
        { ...scope, reconciliation: 'modified' },
        { reconciliation: 'modified' },
        expect.objectContaining({ page: 1, limit: 10 }),
        { signal: expect.any(AbortSignal) }
      )
    );
    expect(await screen.findByRole('gridcell', { name: 'Animal' })).toBeVisible();
  });

  it('shows an outcome with no feature types', async () => {
    mocks.listFeatureTypes.mockResolvedValue({
      feature_types: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
    });
    renderAt();
    expect(await screen.findByText('No feature types found.')).toBeVisible();
  });

  it('opens the properties set for a feature type and returns to the outcome tab it was opened from', async () => {
    renderAt(`${path}?tab=changed`);
    fireEvent.click(await screen.findByRole('gridcell', { name: 'Animal' }));
    expect(await screen.findByRole('heading', { name: 'Animal' })).toBeVisible();
    expect(await screen.findByRole('gridcell', { name: 'Name' })).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Feature type' })).not.toBeInTheDocument();
    expect(mocks.getFeatureTypeProperties).toHaveBeenCalledWith(31, uploadId, 'animal', {
      signal: expect.any(AbortSignal)
    });
    const uploadLink = screen.getByRole('link', { name: 'Upload' });
    expect(uploadLink).toHaveAttribute('href', `${path}?tab=changed`);
    fireEvent.click(uploadLink);
    expect(await screen.findByRole('tab', { name: 'Changed' })).toHaveAttribute('aria-selected', 'true');
  });

  it('lists the upload errors on the Errors tab, without loading or mounting an outcome', async () => {
    renderAt(`${path}?tab=errors`);
    expect(await screen.findByRole('tab', { name: 'Errors' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { name: 'Errors' })).toBeVisible();
    const errorRow = (await screen.findByRole('gridcell', { name: 'invalid_type' })).closest(
      '[role="row"]'
    ) as HTMLElement;
    expect(within(errorRow).getByRole('gridcell', { name: 'Animal' })).toBeVisible();
    expect(within(errorRow).getByRole('gridcell', { name: 'count' })).toBeVisible();
    expect(within(errorRow).getByRole('gridcell', { name: 'Value is not a number' })).toBeVisible();
    expect(within(errorRow).getByRole('gridcell', { name: '42' })).toBeVisible();
    expect(mocks.listErrors).toHaveBeenCalledWith(
      scope,
      { page: 1, limit: 10, sort: 'count', order: 'desc' },
      { signal: expect.any(AbortSignal) }
    );
    expect(screen.queryByTestId('upload-map')).not.toBeInTheDocument();
    expect(mocks.listFeatureTypes).not.toHaveBeenCalled();
  });

  it('pages and sorts the upload errors on the server', async () => {
    renderAt(`${path}?tab=errors`);
    await screen.findByRole('gridcell', { name: 'invalid_type' });
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() =>
      expect(mocks.listErrors).toHaveBeenLastCalledWith(scope, expect.objectContaining({ page: 2, limit: 10 }), {
        signal: expect.any(AbortSignal)
      })
    );
    fireEvent.click(screen.getByRole('columnheader', { name: 'Error' }));
    await waitFor(() =>
      expect(mocks.listErrors).toHaveBeenLastCalledWith(
        scope,
        expect.objectContaining({ sort: 'error_code', order: 'asc' }),
        { signal: expect.any(AbortSignal) }
      )
    );
  });

  it('shows an upload without errors', async () => {
    mocks.listErrors.mockResolvedValue({
      errors: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
    });
    renderAt(`${path}?tab=errors`);
    expect(await screen.findByText('No errors found.')).toBeVisible();
  });

  it('shows the blueprint the upload was created with, without an edit action', async () => {
    renderAt(`${path}?tab=metadata`);
    expect(await screen.findByRole('gridcell', { name: 'Wildlife (Version 1)' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(mocks.getUploadBlueprint).toHaveBeenCalledWith(scope, { signal: expect.any(AbortSignal) });
  });

  it('shows only metadata when opened on the Metadata tab, without loading or mounting an outcome', async () => {
    renderAt(`${path}?tab=metadata`);
    expect(await screen.findByRole('gridcell', { name: uploadId })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Feature types' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('upload-map')).not.toBeInTheDocument();
    expect(mocks.listFeatureTypes).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Unchanged' }));
    expect(await screen.findByRole('gridcell', { name: 'Animal' })).toBeVisible();
    expect(screen.getByTestId('upload-map')).toBeVisible();
  });

  it.each([
    `/admin/submissions/0/uploads/${uploadId}`,
    '/admin/submissions/31/uploads/not-a-uuid',
    '/admin/submissions/31/uploads/not-a-uuid/feature-types/animal'
  ])('rejects invalid route identifiers: %s', async (location) => {
    renderAt(location);
    expect(await screen.findByText('Not found')).toBeVisible();
    expect(mocks.listFeatureTypes).not.toHaveBeenCalled();
    expect(mocks.getFeatureTypeProperties).not.toHaveBeenCalled();
    expect(mocks.getSubmission).not.toHaveBeenCalled();
  });

  it('redirects when an upload does not belong to the submission', async () => {
    mocks.listFeatureTypes.mockRejectedValue(notFoundError());
    renderAt();
    expect(await screen.findByText('Not found')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('redirects a feature type page whose upload does not belong to the submission', async () => {
    mocks.getFeatureTypeProperties.mockRejectedValue(notFoundError());
    renderAt(`${path}/feature-types/animal`);
    expect(await screen.findByText('Not found')).toBeVisible();
  });
});
