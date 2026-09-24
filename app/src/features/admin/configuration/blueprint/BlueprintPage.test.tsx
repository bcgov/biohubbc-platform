import { fireEvent, waitFor, within } from '@testing-library/react';
import { DialogContextProvider } from 'contexts/dialogContext';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { BlueprintPage } from './BlueprintPage';

vi.mock('hooks/useApi');
vi.mock('@mui/x-data-grid', async () => {
  const actual = await vi.importActual<typeof import('@mui/x-data-grid')>('@mui/x-data-grid');
  return {
    ...actual,
    DataGrid: (props: import('@mui/x-data-grid').DataGridProps) => <actual.DataGrid {...props} disableVirtualization />
  };
});
const blueprint = {
  blueprint_id: 1,
  name: 'Draft schema',
  version_number: 2,
  description: 'Metadata',
  is_default: false,
  parent_blueprint_id: 8,
  record_effective_date: null,
  record_end_date: null
};
const type = {
  blueprint_feature_type_id: 2,
  blueprint_id: 1,
  feature_type_id: 3,
  name: 'observation',
  display_name: 'Observation',
  description: 'Type description',
  sort: null,
  record_end_date: null
};
const property = {
  blueprint_feature_type_property_id: 4,
  blueprint_feature_type_id: 2,
  feature_property_id: 5,
  feature_type_name: 'observation',
  name: 'height',
  display_name: 'Height',
  description: 'Property description',
  type_name: 'number',
  required_value: false,
  allow_multiple: false,
  sort: null,
  record_end_date: null
};
const pagination = { total: 21, current_page: 1, last_page: 3, per_page: 10 };
const api = {
  blueprints: { getBlueprint: vi.fn(), updateBlueprint: vi.fn(), publishBlueprint: vi.fn() },
  blueprintFeatureTypes: {
    getBlueprintFeatureTypes: vi.fn(),
    getBlueprintFeatureType: vi.fn(),
    createBlueprintFeatureType: vi.fn(),
    updateBlueprintFeatureType: vi.fn(),
    deleteBlueprintFeatureType: vi.fn()
  },
  blueprintFeatureTypeProperties: {
    getBlueprintFeatureTypeProperties: vi.fn(),
    createBlueprintFeatureTypeProperty: vi.fn(),
    updateBlueprintFeatureTypeProperty: vi.fn(),
    deleteBlueprintFeatureTypeProperty: vi.fn()
  },
  featureTypes: { getAvailableFeatureTypesForBlueprint: vi.fn() },
  featureProperties: { getAvailableFeaturePropertiesForBlueprintFeatureType: vi.fn() }
};
const renderPage = (id = '1', tab = 'feature-types') =>
  render(
    <DialogContextProvider>
      <MemoryRouter initialEntries={[`/admin/configuration/blueprints/${id}?tab=${tab}`]}>
        <Routes>
          <Route path="/admin/configuration/blueprints/:blueprintId" element={<BlueprintPage />} />
        </Routes>
      </MemoryRouter>
    </DialogContextProvider>
  );
describe('Blueprint composition page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useApi as Mock).mockReturnValue(api);
    api.blueprints.getBlueprint.mockResolvedValue(blueprint);
    api.blueprintFeatureTypes.getBlueprintFeatureType.mockResolvedValue(type);
    api.blueprintFeatureTypes.getBlueprintFeatureTypes.mockResolvedValue({ types: [type], pagination });
    api.blueprintFeatureTypeProperties.getBlueprintFeatureTypeProperties.mockResolvedValue({
      properties: [property],
      pagination
    });
    api.featureTypes.getAvailableFeatureTypesForBlueprint.mockResolvedValue({
      options: [{ id: 3, name: 'observation', display_name: 'Observation' }],
      pagination
    });
    api.featureProperties.getAvailableFeaturePropertiesForBlueprintFeatureType.mockResolvedValue({
      options: [{ id: 5, name: 'height', display_name: 'Height' }],
      pagination
    });
  });
  it('shows metadata, breadcrumbs, and independent paginated sections', async () => {
    const page = renderPage();
    await page.findByText('Type description');
    expect(page.queryByText('Property description')).not.toBeInTheDocument();
    expect(page.getByRole('link', { name: 'Blueprints' })).toHaveAttribute(
      'href',
      '/admin/configuration?tab=blueprints'
    );
    expect(page.queryByText(/Identifier:/)).not.toBeInTheDocument();
    fireEvent.click(page.getAllByRole('button', { name: 'Go to next page' })[0]);
    await waitFor(() =>
      expect(api.blueprintFeatureTypes.getBlueprintFeatureTypes).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ keyword: '', page: 2 })
      )
    );
    expect(api.blueprintFeatureTypeProperties.getBlueprintFeatureTypeProperties).not.toHaveBeenCalled();
  });
  it.each(['', 'invalid'])('defaults to Feature Types for tab %j and shows metadata last', async (tab) => {
    const page = renderPage('1', tab);
    expect(await page.findByText('Type description')).toBeVisible();
    expect(page.getByRole('tab', { name: 'Feature Types' })).toHaveAttribute('aria-selected', 'true');
    expect(page.getAllByRole('tab').map((item) => item.textContent)).toEqual(['Feature Types', 'Metadata']);
    fireEvent.click(page.getByRole('tab', { name: 'Metadata' }));
    expect(await page.findByRole('heading', { name: 'Metadata' })).toBeVisible();
    expect(page.getByRole('tab', { name: 'Metadata' })).toHaveAttribute('aria-selected', 'true');
    const panel = within(page.getByRole('tabpanel'));
    expect(panel.getByRole('row', { name: 'ID 1' })).toBeVisible();
    expect(panel.getByRole('row', { name: 'Version 2' })).toBeVisible();
    expect(panel.getByRole('row', { name: 'Parent blueprint 8' })).toBeVisible();
    expect(panel.getByRole('row', { name: 'Default No' })).toBeVisible();
    expect(panel.getByRole('row', { name: 'Effective date' })).toBeVisible();
    expect(panel.getByRole('row', { name: 'End date' })).toBeVisible();
    expect(page.queryByText('Type description')).not.toBeInTheDocument();
    expect(page.queryByText(/Composition can be changed only/)).not.toBeInTheDocument();
  });

  it('edits only name and description from the outlined header button', async () => {
    api.blueprints.updateBlueprint.mockResolvedValue({
      ...blueprint,
      name: 'Updated schema',
      description: 'Updated description'
    });
    const page = renderPage();
    const editButton = await page.findByRole('button', { name: 'Edit' });
    expect(editButton).toHaveClass('MuiButton-outlined', 'MuiButton-sizeSmall');
    fireEvent.click(editButton);
    const dialog = within(page.getByRole('dialog'));
    expect(dialog.getAllByRole('textbox')).toHaveLength(2);
    expect(dialog.queryByRole('combobox')).not.toBeInTheDocument();
    expect(dialog.getByRole('textbox', { name: /Name/ })).toHaveValue('Draft schema');
    fireEvent.change(dialog.getByRole('textbox', { name: /Name/ }), { target: { value: 'Updated schema' } });
    fireEvent.change(dialog.getByRole('textbox', { name: 'Description' }), {
      target: { value: 'Updated description' }
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.blueprints.updateBlueprint).toHaveBeenCalledWith(1, {
        name: 'Updated schema',
        description: 'Updated description'
      })
    );
    expect(await page.findByRole('heading', { name: 'Updated schema' })).toBeVisible();
    expect(page.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('preserves edit values on failure and sends null to clear description', async () => {
    api.blueprints.updateBlueprint.mockRejectedValue(new Error('Edit failed'));
    const page = renderPage();
    fireEvent.click(await page.findByRole('button', { name: 'Edit' }));
    const dialog = within(page.getByRole('dialog'));
    fireEvent.change(dialog.getByRole('textbox', { name: 'Description' }), { target: { value: '' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Edit failed')).toBeVisible();
    expect(api.blueprints.updateBlueprint).toHaveBeenCalledWith(1, { name: 'Draft schema', description: null });
    expect(dialog.getByRole('textbox', { name: 'Description' })).toHaveValue('');
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(page.getByRole('heading', { name: 'Draft schema' })).toBeVisible();
  });

  it('allows descriptive edits on a published blueprint without exposing schema fields', async () => {
    api.blueprints.getBlueprint.mockResolvedValue({ ...blueprint, record_effective_date: '2000-01-01' });
    const page = renderPage();
    const button = await page.findByRole('button', { name: 'Edit' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    const dialog = within(page.getByRole('dialog'));
    expect(dialog.getAllByRole('textbox')).toHaveLength(2);
    expect(dialog.getByRole('textbox', { name: 'Name' })).toBeVisible();
    expect(dialog.getByRole('textbox', { name: 'Description' })).toBeVisible();
    expect(dialog.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.blueprints.updateBlueprint).toHaveBeenCalledWith(1, {
        name: blueprint.name,
        description: blueprint.description
      })
    );
  });

  it('confirms publication and makes composition read-only from the confirmed response', async () => {
    api.blueprints.publishBlueprint.mockResolvedValue({ ...blueprint, record_effective_date: '2000-01-01' });
    const page = renderPage();
    fireEvent.click(await page.findByRole('button', { name: 'Publish' }));
    expect(api.blueprints.publishBlueprint).not.toHaveBeenCalled();
    fireEvent.click(within(page.getByRole('dialog')).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(api.blueprints.publishBlueprint).toHaveBeenCalledWith(1));
    expect(await page.findByText('Blueprint published')).toBeVisible();
    expect(page.getByRole('button', { name: 'Published' })).toHaveClass('MuiButton-colorSuccess');
    fireEvent.click(page.getByRole('button', { name: 'close' }));
    await waitFor(() => expect(page.queryByText('Blueprint published')).not.toBeInTheDocument());
    expect(page.queryByTestId('blueprint-types-add-button')).not.toBeInTheDocument();
    fireEvent.click(page.getByRole('tab', { name: 'Metadata' }));
    expect(page.getByRole('row', { name: 'Effective date 2000-01-01' })).toBeVisible();
  });

  it('shows publication details without publishing again', async () => {
    api.blueprints.getBlueprint.mockResolvedValue({ ...blueprint, record_effective_date: '2000-01-01' });
    const page = renderPage();
    const button = await page.findByRole('button', { name: 'Published' });
    expect(button).toHaveClass('MuiButton-colorSuccess');
    fireEvent.click(button);
    const dialog = within(page.getByRole('dialog'));
    expect(
      dialog.getByText('This blueprint was published on 2000-01-01. To make changes, create a new blueprint.')
    ).toBeVisible();
    fireEvent.click(dialog.getByRole('button', { name: /ok/i }));
    await waitFor(() => expect(page.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.blueprints.publishBlueprint).not.toHaveBeenCalled();
  });

  it('keeps the draft editable when publication fails and allows cancelling confirmation', async () => {
    api.blueprints.publishBlueprint.mockRejectedValue(new Error('Publication failed'));
    const page = renderPage();
    fireEvent.click(await page.findByRole('button', { name: 'Publish' }));
    fireEvent.click(within(page.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(api.blueprints.publishBlueprint).not.toHaveBeenCalled();
    fireEvent.click(page.getByRole('button', { name: 'Publish' }));
    fireEvent.click(within(page.getByRole('dialog')).getByRole('button', { name: 'Publish' }));
    expect(await page.findByText('Publication failed')).toBeVisible();
    fireEvent.click(page.getByTestId('blueprint-types-add-button'));
    expect(page.getByRole('dialog')).toHaveTextContent('Assign Feature Types');
  });

  it.each([{ record_effective_date: '2999-01-01' }, { record_end_date: '2020-01-01' }])(
    'explains why non-draft blueprints cannot be published %j',
    async (state) => {
      api.blueprints.getBlueprint.mockResolvedValue({ ...blueprint, ...state });
      const page = renderPage();
      const button = await page.findByRole('button', { name: 'Publish' });
      expect(button).toBeEnabled();
      fireEvent.click(button);
      expect(await page.findByText('Only draft blueprints can be published')).toBeVisible();
      expect(api.blueprints.publishBlueprint).not.toHaveBeenCalled();
    }
  );

  it('shows a full-page skeleton instead of a fallback header until metadata loads', async () => {
    let resolveBlueprint!: (value: typeof blueprint) => void;
    api.blueprints.getBlueprint.mockReturnValue(
      new Promise((resolve) => {
        resolveBlueprint = resolve;
      })
    );
    const page = renderPage();
    expect(page.getByTestId('blueprint-skeleton')).toBeVisible();
    expect(page.queryByRole('heading', { name: 'Blueprint' })).not.toBeInTheDocument();
    expect(page.queryByRole('tablist')).not.toBeInTheDocument();
    expect(api.blueprintFeatureTypes.getBlueprintFeatureTypes).not.toHaveBeenCalled();
    resolveBlueprint(blueprint);
    expect(await page.findByRole('heading', { name: 'Draft schema' })).toBeVisible();
    expect(page.queryByTestId('blueprint-skeleton')).not.toBeInTheDocument();
    expect(page.getByRole('tab', { name: 'Feature Types' })).toBeVisible();
  });

  it('shows metadata errors without fetching composition', async () => {
    api.blueprints.getBlueprint.mockRejectedValue(new Error('Blueprint not found'));
    const page = renderPage();
    expect(await page.findByRole('alert')).toHaveTextContent('Blueprint not found');
    expect(await page.findByRole('tab', { name: 'Feature Types' })).toBeVisible();
    expect(page.getByRole('link', { name: 'Blueprints' })).toBeVisible();
    expect(page.queryByTestId('blueprint-skeleton')).not.toBeInTheDocument();
    expect(api.blueprintFeatureTypes.getBlueprintFeatureTypes).not.toHaveBeenCalled();
  });
  it('searches and assigns an existing feature type without setting sort order', async () => {
    const page = renderPage();
    await page.findByText('Type description');
    fireEvent.click(page.getByTestId('blueprint-types-add-button'));
    const dialog = within(page.getByRole('dialog'));
    const input = dialog.getByPlaceholderText('Search feature types');
    fireEvent.change(input, { target: { value: 'observation' } });
    await waitFor(() =>
      expect(api.featureTypes.getAvailableFeatureTypesForBlueprint).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ keyword: 'observation', page: 1, limit: 10 })
      )
    );
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.click(await page.findByRole('option', { name: 'observation' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.blueprintFeatureTypes.createBlueprintFeatureType).toHaveBeenCalledWith(1, {
        featureTypeId: 3
      })
    );
  });
  it('stores multiple types as removable cards, clears the input, and retries only unsaved selections', async () => {
    api.featureTypes.getAvailableFeatureTypesForBlueprint.mockResolvedValue({
      options: [
        { id: 3, name: 'observation', display_name: 'Observation' },
        { id: 6, name: 'sample', display_name: 'Sample' },
        { id: 7, name: 'site', display_name: 'Site' }
      ],
      pagination
    });
    api.blueprintFeatureTypes.createBlueprintFeatureType
      .mockResolvedValueOnce(type)
      .mockRejectedValueOnce(new Error('Assignment failed'))
      .mockResolvedValueOnce(type);
    const page = renderPage();
    await page.findByText('Type description');
    fireEvent.click(page.getByTestId('blueprint-types-add-button'));
    const dialog = within(page.getByRole('dialog'));
    const input = dialog.getByPlaceholderText('Search feature types');
    for (const label of ['observation', 'sample', 'site', 'observation']) {
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.click(await page.findByRole('option', { name: label }));
      expect(input).toHaveValue('');
    }
    expect(dialog.getAllByRole('button', { name: 'Remove observation' })).toHaveLength(1);
    fireEvent.click(dialog.getByRole('button', { name: 'Remove sample' }));
    expect(api.blueprintFeatureTypes.createBlueprintFeatureType).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Assignment failed')).toBeVisible();
    expect(api.blueprintFeatureTypes.createBlueprintFeatureType).toHaveBeenNthCalledWith(1, 1, { featureTypeId: 3 });
    expect(api.blueprintFeatureTypes.createBlueprintFeatureType).toHaveBeenNthCalledWith(2, 1, { featureTypeId: 7 });
    expect(dialog.queryByRole('button', { name: 'Remove observation' })).not.toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Remove site' })).toBeVisible();
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(page.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.blueprintFeatureTypes.createBlueprintFeatureType).toHaveBeenCalledTimes(3);
    expect(api.blueprintFeatureTypes.createBlueprintFeatureType).toHaveBeenLastCalledWith(1, { featureTypeId: 7 });
  });

  it('requires at least one type before saving', async () => {
    const page = renderPage();
    await page.findByText('Type description');
    fireEvent.click(page.getByTestId('blueprint-types-add-button'));
    fireEvent.click(within(page.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    expect(await page.findByText('Select at least one feature type')).toBeVisible();
    expect(api.blueprintFeatureTypes.createBlueprintFeatureType).not.toHaveBeenCalled();
  });

  it('confirms cascading deletion and refreshes feature types', async () => {
    const page = renderPage();
    await page.findByText('Type description');
    fireEvent.click(page.getByTitle('Actions for observation'));
    fireEvent.click(page.getByRole('menuitem', { name: 'Delete' }));
    expect(api.blueprintFeatureTypes.deleteBlueprintFeatureType).not.toHaveBeenCalled();
    const dialog = within(page.getByRole('dialog'));
    expect(dialog.getByText(/active properties will also/)).toBeVisible();
    fireEvent.click(dialog.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.blueprintFeatureTypes.deleteBlueprintFeatureType).toHaveBeenCalledWith(1, 2));
    await waitFor(() => expect(api.blueprintFeatureTypes.getBlueprintFeatureTypes).toHaveBeenCalledTimes(2));
  });
  it('keeps deleted assignment actions enabled and explains restrictions', async () => {
    api.blueprintFeatureTypes.getBlueprintFeatureTypes.mockResolvedValue({
      types: [{ ...type, record_end_date: '2020-01-01' }],
      pagination
    });
    const page = renderPage();
    await page.findByText('Type description');
    fireEvent.click(page.getByTitle('Actions for observation'));
    expect(page.getByRole('menuitem', { name: 'Delete' })).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(page.getByRole('menuitem', { name: 'Delete' }));
    expect(await page.findByRole('alert')).toHaveTextContent('Assignment is already deleted');
  });
  it('shows server lifecycle conflicts in a snackbar without refreshing', async () => {
    api.blueprintFeatureTypes.deleteBlueprintFeatureType.mockRejectedValue(
      new Error('Only draft and future blueprints can be edited')
    );
    const page = renderPage();
    await page.findByText('Type description');
    fireEvent.click(page.getByTitle('Actions for observation'));
    fireEvent.click(page.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(within(page.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await page.findByRole('alert')).toHaveTextContent('Only draft and future');
    expect(api.blueprintFeatureTypes.getBlueprintFeatureTypes).toHaveBeenCalledTimes(1);
  });
  it.each([{ record_effective_date: '2000-01-01' }, { record_end_date: '2020-01-01' }])(
    'hides Assign for a read-only blueprint %j',
    async (state) => {
      api.blueprints.getBlueprint.mockResolvedValue({ ...blueprint, ...state });
      const page = renderPage();
      await page.findByText('Type description');
      expect(page.queryByTestId('blueprint-types-add-button')).not.toBeInTheDocument();
      expect(page.queryByRole('dialog')).toBeNull();
    }
  );
  it('searches the top ten feature types without pagination controls', async () => {
    const page = renderPage();
    await page.findByText('Type description');
    fireEvent.click(page.getByTestId('blueprint-types-add-button'));
    const dialog = within(page.getByRole('dialog'));
    expect(dialog.queryByRole('navigation')).not.toBeInTheDocument();
    fireEvent.change(dialog.getByPlaceholderText('Search feature types'), { target: { value: 'sample' } });
    await waitFor(() =>
      expect(api.featureTypes.getAvailableFeatureTypesForBlueprint).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ keyword: 'sample', page: 1, limit: 10 })
      )
    );
  });
});
