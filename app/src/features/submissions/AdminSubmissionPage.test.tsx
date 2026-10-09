import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';
import { AdminSubmissionPage } from './AdminSubmissionPage';

// Interaction-heavy DataGrid + dialog Autocomplete suite: each test renders the full page and chains
// dialog interactions, which can exceed the default 5s ceiling when the whole app suite is running.
const interactionTimeout = 20000;
vi.setConfig({ testTimeout: interactionTimeout });

const mocks = vi.hoisted(() => ({
  getSubmission: vi.fn(),
  listUploads: vi.fn(),
  getDefaultBlueprint: vi.fn(),
  updateDefaultBlueprint: vi.fn(),
  getBlueprints: vi.fn(),
  setSnackbar: vi.fn(),
  roleNames: [] as string[]
}));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    submissions: {
      getSubmissionRecordWithSecurity: mocks.getSubmission,
      listAdminSubmissionUploads: mocks.listUploads
    },
    admin: {
      getSubmissionDefaultBlueprint: mocks.getDefaultBlueprint,
      updateSubmissionDefaultBlueprint: mocks.updateDefaultBlueprint
    },
    blueprints: { getBlueprints: mocks.getBlueprints }
  })
}));
vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setSnackbar: mocks.setSnackbar, setOkDialog: vi.fn() })
}));
vi.mock('hooks/useAuthStateContext', () => ({
  useAuthStateContext: () => ({ biohubUserWrapper: { roleNames: mocks.roleNames } })
}));

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
const telemetryBlueprint = { ...blueprint, blueprint_id: 2, name: 'Telemetry', version_number: 2, is_default: false };
const draftBlueprint = { ...blueprint, blueprint_id: 3, name: 'Draft plan', record_effective_date: null };

const upload = {
  submission_upload_id: '22222222-2222-4222-8222-222222222222',
  upload_id: '33333333-3333-4333-8333-333333333333',
  ticket_id: '44444444-4444-4444-8444-444444444444',
  status: 'indexed',
  decision: 'pending',
  comment: 'Updated observations',
  create_date: '2026-10-01T12:00:00Z',
  create_user: 42,
  submitted_by_identifier: 'admin@example.com'
};

/**
 * Render the admin submission route with its real header, tabs and grids.
 *
 * @param {string} path Route to open.
 * @returns The RTL render result.
 */
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/submissions/:submission_id" element={<AdminSubmissionPage />} />
        <Route
          path={`/admin/submissions/7/uploads/${upload.submission_upload_id}`}
          element={<div>Upload details</div>}
        />
        <Route path="/page-not-found" element={<div>Not found</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('AdminSubmissionPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.roleNames = ['System Administrator'];
    mocks.getDefaultBlueprint.mockResolvedValue(blueprint);
    mocks.getBlueprints.mockResolvedValue({ blueprints: [blueprint, telemetryBlueprint, draftBlueprint] });
    mocks.getSubmission.mockResolvedValue({
      submission_id: 7,
      name: 'Submission seven',
      description: 'A submission description',
      uuid: '11111111-1111-4111-8111-111111111111',
      contributor_id: 5,
      contributor_name: 'SIMS',
      create_date: '2026-09-01T12:00:00Z',
      create_user: 42,
      update_date: null,
      update_user: null,
      revision_count: 0,
      submitted_timestamp: '2026-09-01T12:00:00Z',
      security_review_timestamp: null,
      publish_timestamp: null
    });
    mocks.listUploads.mockResolvedValue({ uploads: [upload], pagination: { total: 11 } });
  });

  it('shows scoped uploads by default and navigates to the clicked upload', async () => {
    renderAt('/admin/submissions/7');
    expect(await screen.findByRole('heading', { name: 'Submission seven' })).toBeVisible();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Uploads', 'Metadata']);
    expect(screen.getByRole('tab', { name: 'Uploads' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Updated observations')).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Ticket' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Upload ID',
      'Status',
      'Comment',
      'Decision',
      'Created'
    ]);
    expect(screen.getByRole('gridcell', { name: 'Indexed' })).toBeVisible();
    expect(screen.getByRole('gridcell', { name: 'Pending' })).toBeVisible();
    expect(mocks.listUploads).toHaveBeenCalledWith(
      7,
      { page: 1, limit: 10, sort: 'create_date', order: 'desc' },
      { signal: expect.any(AbortSignal) }
    );
    fireEvent.click(screen.getByText('Updated observations'));
    expect(await screen.findByText('Upload details')).toBeVisible();
  });

  /**
   * Open the default blueprint edit dialog from the Metadata tab.
   * @returns Queries scoped to the open dialog.
   */
  const openDefaultBlueprintDialog = async () => {
    renderAt('/admin/submissions/7?tab=metadata');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit default_blueprint' }));
    return within(await screen.findByRole('dialog'));
  };

  it('saves a default blueprint selected in the edit dialog', async () => {
    mocks.updateDefaultBlueprint.mockResolvedValue(undefined);
    const dialog = await openDefaultBlueprintDialog();
    expect(mocks.getDefaultBlueprint).toHaveBeenCalledWith(7, { signal: expect.any(AbortSignal) });
    expect(dialog.getByText('Wildlife (Version 1)')).toBeVisible();
    fireEvent.mouseDown(dialog.getByRole('combobox', { name: 'Search blueprints' }));
    expect(await screen.findByRole('option', { name: 'Draft plan (Version 1) - Draft' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    fireEvent.click(screen.getByRole('option', { name: 'Telemetry (Version 2)' }));
    expect(dialog.getByText('Telemetry (Version 2)')).toBeVisible();
    expect(dialog.queryByText('Wildlife (Version 1)')).not.toBeInTheDocument();
    expect(mocks.updateDefaultBlueprint).not.toHaveBeenCalled();
    mocks.getDefaultBlueprint.mockResolvedValue(telemetryBlueprint);
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.updateDefaultBlueprint).toHaveBeenCalledWith(7, 2));
    expect(await screen.findByRole('gridcell', { name: 'Telemetry (Version 2)' })).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Default blueprint updated' });
  });

  it('blocks saving after the selected blueprint is removed until another is picked', async () => {
    mocks.updateDefaultBlueprint.mockResolvedValue(undefined);
    const dialog = await openDefaultBlueprintDialog();
    fireEvent.click(dialog.getByRole('button', { name: 'remove Wildlife (Version 1)' }));
    expect(dialog.queryByText('Wildlife (Version 1)')).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Select a blueprint')).toBeVisible();
    expect(mocks.updateDefaultBlueprint).not.toHaveBeenCalled();
    fireEvent.mouseDown(dialog.getByRole('combobox', { name: 'Search blueprints' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Telemetry (Version 2)' }));
    expect(dialog.queryByText('Select a blueprint')).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.updateDefaultBlueprint).toHaveBeenCalledWith(7, 2));
  });

  it('discards a removed selection on cancel and saves nothing when unchanged', async () => {
    const dialog = await openDefaultBlueprintDialog();
    fireEvent.click(dialog.getByRole('button', { name: 'remove Wildlife (Version 1)' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('gridcell', { name: 'Wildlife (Version 1)' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Edit default_blueprint' }));
    const reopened = within(await screen.findByRole('dialog'));
    expect(reopened.getByText('Wildlife (Version 1)')).toBeVisible();
    fireEvent.click(reopened.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocks.updateDefaultBlueprint).not.toHaveBeenCalled();
  });

  it('searches blueprints on the server by keyword', async () => {
    const dialog = await openDefaultBlueprintDialog();
    fireEvent.change(dialog.getByRole('combobox', { name: 'Search blueprints' }), { target: { value: 'tele' } });
    await waitFor(() => expect(mocks.getBlueprints).toHaveBeenLastCalledWith({ keyword: 'tele' }, expect.any(Object)));
  });

  it('reports a rejected save in a snackbar and keeps the selection', async () => {
    mocks.updateDefaultBlueprint.mockRejectedValue(new Error('Requested Blueprint is not available'));
    const dialog = await openDefaultBlueprintDialog();
    fireEvent.mouseDown(dialog.getByRole('combobox', { name: 'Search blueprints' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Telemetry (Version 2)' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mocks.setSnackbar).toHaveBeenCalledWith({
        open: true,
        snackbarMessage: 'Requested Blueprint is not available'
      })
    );
    expect(dialog.queryByText('Requested Blueprint is not available')).not.toBeInTheDocument();
    expect(dialog.getByText('Telemetry (Version 2)')).toBeVisible();
  });

  it('shows the default blueprint without an edit action to data administrators', async () => {
    mocks.roleNames = ['Data Administrator'];
    renderAt('/admin/submissions/7?tab=metadata');
    expect(await screen.findByRole('gridcell', { name: 'Wildlife (Version 1)' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Edit default_blueprint' })).not.toBeInTheDocument();
  });

  it('keeps pagination when switching to metadata and back', async () => {
    renderAt('/admin/submissions/7');
    await screen.findByText('Updated observations');
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() =>
      expect(mocks.listUploads).toHaveBeenLastCalledWith(
        7,
        { page: 2, limit: 10, sort: 'create_date', order: 'desc' },
        { signal: expect.any(AbortSignal) }
      )
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Metadata' }));
    const metadata = within(screen.getByRole('tabpanel', { name: 'Metadata' }));
    expect(metadata.getByRole('row', { name: 'create_user 42' })).toBeVisible();
    expect(metadata.getByRole('row', { name: 'create_date 2026-09-01T12:00:00Z' })).toBeVisible();
    expect(metadata.getByRole('row', { name: 'contributor_name SIMS' })).toBeVisible();
    expect(metadata.getAllByRole('row')).toHaveLength(7);
    expect(metadata.queryByText('contributor_id')).not.toBeInTheDocument();
    expect(metadata.queryByText('update_date')).not.toBeInTheDocument();
    expect(metadata.queryByText('update_user')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Uploads' }));
    expect(screen.getByText('11–11 of 11')).toBeVisible();
    expect(mocks.listUploads).toHaveBeenCalledTimes(2);
  });

  it('supports opening the metadata tab directly', async () => {
    renderAt('/admin/submissions/7?tab=metadata');
    expect(await screen.findByRole('tabpanel', { name: 'Metadata' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Metadata' })).toHaveAttribute('aria-selected', 'true');
  });

  it('sorts uploads on the server', async () => {
    renderAt('/admin/submissions/7');
    await screen.findByText('Updated observations');
    fireEvent.click(screen.getByRole('columnheader', { name: /Status/ }));
    await waitFor(() =>
      expect(mocks.listUploads).toHaveBeenLastCalledWith(
        7,
        { page: 1, limit: 10, sort: 'status', order: 'asc' },
        { signal: expect.any(AbortSignal) }
      )
    );
  });

  it('preserves the requested page without an error banner after a pagination failure', async () => {
    renderAt('/admin/submissions/7');
    await screen.findByText('Updated observations');
    mocks.listUploads.mockRejectedValueOnce(new Error('Unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() => expect(screen.queryByText('Updated observations')).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('11–11 of 11')).toBeVisible();
    expect(mocks.listUploads).toHaveBeenLastCalledWith(
      7,
      { page: 2, limit: 10, sort: 'create_date', order: 'desc' },
      { signal: expect.any(AbortSignal) }
    );
  });

  it('shows an empty uploads state', async () => {
    mocks.listUploads.mockResolvedValue({ uploads: [], pagination: { total: 0 } });
    renderAt('/admin/submissions/7');
    expect(await screen.findByText('No uploads found.')).toBeVisible();
  });

  it('does not show an error banner when uploads fail to load', async () => {
    mocks.listUploads.mockRejectedValueOnce(new Error('Unavailable'));
    renderAt('/admin/submissions/7');
    expect(await screen.findByText('No uploads found.')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show an error banner or request uploads when the submission fails to load', async () => {
    mocks.getSubmission.mockRejectedValue(new Error('Missing'));
    renderAt('/admin/submissions/7');
    expect(await screen.findByRole('heading', { name: 'Submission' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.listUploads).not.toHaveBeenCalled();
  });

  it('redirects invalid identifiers without fetching', () => {
    renderAt('/admin/submissions/not-a-number');
    expect(screen.getByText('Not found')).toBeVisible();
    expect(mocks.getSubmission).not.toHaveBeenCalled();
    expect(mocks.listUploads).not.toHaveBeenCalled();
  });
});
