import { fireEvent, waitFor, within } from '@testing-library/react';
import { DialogContextProvider } from 'contexts/dialogContext';
import dayjs from 'dayjs';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { ConfigurationPage } from './ConfigurationPage';

vi.mock('hooks/useApi');
vi.mock('@mui/x-data-grid', async () => {
  const actual = await vi.importActual<typeof import('@mui/x-data-grid')>('@mui/x-data-grid');
  return {
    ...actual,
    DataGrid: (props: import('@mui/x-data-grid').DataGridProps) => <actual.DataGrid {...props} disableVirtualization />
  };
});
const featureType = {
  feature_type_id: 1,
  name: 'observation',
  display_name: 'Observation',
  description: 'Records',
  record_effective_date: '2020-01-01',
  record_end_date: null
};
const property = {
  feature_property_id: 1,
  name: 'count',
  display_name: 'Count',
  description: 'Observed count',
  feature_property_type_id: 2,
  type_name: 'number',
  calculated_value: false,
  record_effective_date: '2020-01-01',
  record_end_date: null
};
const blueprint = {
  blueprint_id: 1,
  name: 'Standard schema',
  version_number: 1,
  description: 'Schema description',
  record_effective_date: '2000-01-01',
  record_end_date: null,
  parent_blueprint_id: null,
  is_default: false
};
const pagination = { total: 21, current_page: 1, last_page: 3, per_page: 10 };
const api = {
  featureTypes: {
    getFeatureTypes: vi.fn(),
    createFeatureType: vi.fn(),
    updateFeatureType: vi.fn(),
    deleteFeatureType: vi.fn()
  },
  featureProperties: {
    getFeatureProperties: vi.fn(),
    getFeaturePropertyTypes: vi.fn(),
    createFeatureProperty: vi.fn(),
    updateFeatureProperty: vi.fn(),
    deleteFeatureProperty: vi.fn()
  },
  blueprints: {
    getBlueprints: vi.fn(),
    getBlueprint: vi.fn(),
    createBlueprint: vi.fn(),
    updateBlueprint: vi.fn(),
    retireBlueprint: vi.fn(),
    setDefaultBlueprint: vi.fn()
  }
};

const renderPage = (entry = '/admin/configuration') =>
  render(
    <DialogContextProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/admin/configuration" element={<ConfigurationPage />} />
          <Route path="/admin/configuration/blueprints/1" element={<div>Blueprint composition page</div>} />
        </Routes>
      </MemoryRouter>
    </DialogContextProvider>
  );

describe('Configuration administration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useApi as Mock).mockReturnValue(api);
    api.featureTypes.getFeatureTypes.mockResolvedValue({ feature_types: [featureType], pagination });
    api.featureProperties.getFeatureProperties.mockResolvedValue({ feature_properties: [property], pagination });
    api.featureProperties.getFeaturePropertyTypes.mockResolvedValue({
      feature_property_types: [{ feature_property_type_id: 2, name: 'number' }]
    });
    api.blueprints.getBlueprints.mockResolvedValue({ blueprints: [blueprint], pagination });
    api.blueprints.getBlueprint.mockResolvedValue(blueprint);
  });

  it.each(['/admin/configuration', '/admin/configuration?tab=invalid'])(
    'defaults to Blueprints for %s',
    async (url) => {
      const page = renderPage(url);
      await waitFor(() => expect(api.blueprints.getBlueprints).toHaveBeenCalled());
      expect(page.getByRole('tab', { name: 'Blueprints' })).toHaveAttribute('aria-selected', 'true');
      expect(api.featureTypes.getFeatureTypes).not.toHaveBeenCalled();
      expect(api.featureProperties.getFeatureProperties).not.toHaveBeenCalled();
    }
  );

  it('resets pagination on each tab activation', async () => {
    const page = renderPage('/admin/configuration?tab=feature-types');
    await page.findByText('observation');
    fireEvent.click(page.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() =>
      expect(api.featureTypes.getFeatureTypes).toHaveBeenLastCalledWith(
        { search: '' },
        expect.objectContaining({ page: 2 })
      )
    );
    fireEvent.click(page.getByRole('tab', { name: 'Properties' }));
    await page.findByText('Observed count');
    fireEvent.click(page.getByRole('tab', { name: 'Feature Types' }));
    await waitFor(() =>
      expect(api.featureTypes.getFeatureTypes).toHaveBeenLastCalledWith(
        { search: '' },
        expect.objectContaining({ page: 1 })
      )
    );
  });

  it('creates feature metadata using the existing snake_case contract', async () => {
    const page = renderPage('/admin/configuration?tab=feature-types');
    await page.findByText('observation');
    fireEvent.click(page.getByTestId('feature-types-add-button'));
    const dialog = within(page.getByRole('dialog'));
    fireEvent.change(dialog.getByRole('textbox', { name: /^Name/ }), { target: { value: 'sample' } });
    fireEvent.change(dialog.getByLabelText('Display name', { exact: false }), { target: { value: 'Sample' } });
    expect(dialog.queryByLabelText('Version')).not.toBeInTheDocument();
    expect(dialog.queryByLabelText('Effective date')).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(api.featureTypes.createFeatureType).toHaveBeenCalledWith({
        name: 'sample',
        display_name: 'Sample',
        description: null
      })
    );
  });

  it('only edits feature type display name and description', async () => {
    const page = renderPage('/admin/configuration?tab=feature-types');
    await page.findByText('observation');
    fireEvent.click(page.getByTitle('Actions for observation'));
    fireEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    const dialog = within(page.getByRole('dialog'));
    expect(dialog.getAllByRole('textbox')).toHaveLength(2);
    expect(dialog.queryByLabelText('Name')).not.toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText(/Display name/), { target: { value: 'Updated label' } });
    fireEvent.change(dialog.getByLabelText('Description'), { target: { value: '' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.featureTypes.updateFeatureType).toHaveBeenCalledWith(1, {
        display_name: 'Updated label',
        description: null
      })
    );
  });

  it('keeps property type immutable and omits it from update requests', async () => {
    const page = renderPage('/admin/configuration?tab=properties');
    await page.findByText('Observed count');
    fireEvent.click(page.getByTitle('Actions for count'));
    fireEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    const dialog = within(page.getByRole('dialog'));
    expect(dialog.queryByRole('combobox')).not.toBeInTheDocument();
    expect(dialog.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(dialog.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.featureProperties.updateFeatureProperty).toHaveBeenCalledWith(1, {
        display_name: 'Count',
        description: 'Observed count'
      })
    );
  });

  it.each(['feature-types', 'properties'])('allows editing retired global definitions in %s', async (tab) => {
    const isType = tab === 'feature-types';
    api.featureTypes.getFeatureTypes.mockResolvedValue({
      feature_types: [{ ...featureType, record_end_date: '2000-01-01' }],
      pagination
    });
    api.featureProperties.getFeatureProperties.mockResolvedValue({
      feature_properties: [{ ...property, record_end_date: '2000-01-01' }],
      pagination
    });
    const page = renderPage(`/admin/configuration?tab=${tab}`);
    expect(await page.findByText('Retired')).toBeVisible();
    fireEvent.click(page.getByTitle(`Actions for ${isType ? featureType.name : property.name}`));
    fireEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    const dialog = within(page.getByRole('dialog'));
    expect(dialog.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(dialog.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.change(dialog.getByRole('textbox', { name: /Display name/ }), { target: { value: 'Updated label' } });
    fireEvent.change(dialog.getByRole('textbox', { name: 'Description' }), { target: { value: '' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    const update = isType ? api.featureTypes.updateFeatureType : api.featureProperties.updateFeatureProperty;
    await waitFor(() => expect(update).toHaveBeenCalledWith(1, { display_name: 'Updated label', description: null }));
  });

  it('keeps the current page and shows Retired after deleting its only row', async () => {
    api.featureTypes.deleteFeatureType.mockImplementation(async () => {
      api.featureTypes.getFeatureTypes.mockResolvedValue({
        feature_types: [{ ...featureType, record_end_date: '2000-01-01' }],
        pagination
      });
    });
    const page = renderPage('/admin/configuration?tab=feature-types');
    await page.findByText('observation');
    fireEvent.click(page.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() =>
      expect(api.featureTypes.getFeatureTypes).toHaveBeenLastCalledWith(
        { search: '' },
        expect.objectContaining({ page: 2 })
      )
    );
    fireEvent.click(page.getByTitle('Actions for observation'));
    fireEvent.click(page.getByRole('menuitem', { name: 'Retire' }));
    fireEvent.click(within(page.getByRole('dialog')).getByRole('button', { name: 'Retire' }));
    await waitFor(() => expect(api.featureTypes.deleteFeatureType).toHaveBeenCalledWith(1));
    await waitFor(() =>
      expect(api.featureTypes.getFeatureTypes).toHaveBeenLastCalledWith(
        { search: '' },
        expect.objectContaining({ page: 2 })
      )
    );
    expect(await page.findByText('Retired')).toBeVisible();
  });

  it.each(['feature-types', 'properties'])('consolidates lifecycle dates into status chips for %s', async (tab) => {
    const states = [
      { record_effective_date: null, record_end_date: null },
      { record_effective_date: '2999-01-01', record_end_date: null },
      { record_effective_date: '2000-01-01', record_end_date: '2999-01-01' },
      { record_effective_date: null, record_end_date: '2001-01-01' }
    ];
    api.featureTypes.getFeatureTypes.mockResolvedValue({
      feature_types: states.map((state, index) => ({ ...featureType, ...state, feature_type_id: index + 1 })),
      pagination
    });
    api.featureProperties.getFeatureProperties.mockResolvedValue({
      feature_properties: states.map((state, index) => ({ ...property, ...state, feature_property_id: index + 1 })),
      pagination
    });
    const page = renderPage(`/admin/configuration?tab=${tab}`);
    for (const [status, color] of [
      ['Draft', 'Default'],
      ['Scheduled', 'Info'],
      ['Active', 'Success'],
      ['Retired', 'Default']
    ]) {
      const chip = await page.findByText(status);
      expect(chip.closest('.MuiChip-root')).toHaveClass(`MuiChip-color${color}`);
    }
    expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    expect(page.queryByRole('columnheader', { name: 'Effective date' })).not.toBeInTheDocument();
    expect(page.queryByRole('columnheader', { name: 'End date' })).not.toBeInTheDocument();
  });

  it('creates a draft blueprint by omitting its effective date', async () => {
    const page = renderPage('/admin/configuration?tab=blueprints');
    await page.findByText('Standard schema');
    fireEvent.click(page.getByTestId('blueprints-add-button'));
    const dialog = within(page.getByRole('dialog'));
    fireEvent.change(dialog.getByRole('textbox', { name: /^Name/ }), { target: { value: 'Draft' } });
    expect(dialog.queryByLabelText('Version')).not.toBeInTheDocument();
    expect(dialog.queryByLabelText('Effective date')).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(api.blueprints.createBlueprint).toHaveBeenCalledWith({
        name: 'Draft',
        description: null,
        parentBlueprintId: null
      })
    );
  });

  it.each(['2000-01-01', new Date().toLocaleDateString('en-CA')])(
    'allows descriptive metadata edits once effective on %s',
    async (record_effective_date) => {
      api.blueprints.getBlueprints.mockResolvedValue({
        blueprints: [{ ...blueprint, record_effective_date }],
        pagination
      });
      const page = renderPage('/admin/configuration?tab=blueprints');
      await page.findByText('Standard schema');
      fireEvent.click(page.getByTitle('Actions for Standard schema'));
      fireEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
      const dialog = within(page.getByRole('dialog'));
      expect(dialog.getAllByRole('textbox')).toHaveLength(2);
      expect(dialog.queryByRole('combobox')).not.toBeInTheDocument();
      fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(api.blueprints.updateBlueprint).toHaveBeenCalledWith(1, {
          name: 'Standard schema',
          description: 'Schema description'
        })
      );
    }
  );

  it('edits scheduled metadata without clearing its effective date', async () => {
    api.blueprints.getBlueprints.mockResolvedValue({
      blueprints: [{ ...blueprint, record_effective_date: '2999-01-01' }],
      pagination
    });
    const page = renderPage('/admin/configuration?tab=blueprints');
    await page.findByText('Standard schema');
    fireEvent.click(page.getByTitle('Actions for Standard schema'));
    fireEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    const dialog = within(page.getByRole('dialog'));
    expect(dialog.queryByLabelText('Effective date')).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.blueprints.updateBlueprint).toHaveBeenCalledWith(1, {
        name: 'Standard schema',
        description: 'Schema description'
      })
    );
  });

  it.each<[string | null, string | null, string, string]>([
    [null, null, 'Draft', 'default'],
    ['2999-01-01', null, 'Scheduled', 'info'],
    ['2000-01-01', null, 'Active', 'success'],
    [dayjs().format('YYYY-MM-DD'), null, 'Active', 'success'],
    ['2000-01-01', '2999-01-01', 'Active', 'success'],
    ['2000-01-01', '2001-01-01', 'Retired', 'default'],
    [null, dayjs().format('YYYY-MM-DD'), 'Retired', 'default']
  ])('shows status for effective %s and end %s as %s', async (effectiveDate, endDate, status, color) => {
    api.blueprints.getBlueprints.mockResolvedValue({
      blueprints: [{ ...blueprint, record_effective_date: effectiveDate, record_end_date: endDate }],
      pagination
    });
    const page = renderPage('/admin/configuration?tab=blueprints');
    const label = await page.findByText(status);
    expect(label.closest('.MuiChip-root')).toHaveClass(`MuiChip-color${color[0].toUpperCase()}${color.slice(1)}`);
    expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    expect(page.queryByRole('columnheader', { name: 'Effective date' })).not.toBeInTheDocument();
  });

  it('searches the top ten parent blueprints and saves the selected identifier', async () => {
    const parent = {
      ...blueprint,
      blueprint_id: 8,
      name: 'Parent schema',
      version_number: 8,
      record_end_date: '2020-01-01'
    };
    api.blueprints.getBlueprints.mockImplementation(async (_filters, options) => ({
      blueprints: _filters.keyword === 'Parent' ? [parent] : [blueprint],
      pagination: { ...pagination, current_page: options.page }
    }));
    const page = renderPage('/admin/configuration?tab=blueprints');
    await page.findByText('Standard schema');
    fireEvent.click(page.getByTestId('blueprints-add-button'));
    const dialog = within(page.getByRole('dialog'));
    const input = dialog.getByRole('combobox', { name: 'Parent blueprint (optional)' });
    fireEvent.change(input, { target: { value: 'Parent' } });
    await waitFor(() =>
      expect(api.blueprints.getBlueprints).toHaveBeenLastCalledWith(
        { keyword: 'Parent' },
        { page: 1, limit: 10, sort: 'name', order: 'asc' }
      )
    );
    expect(dialog.queryByRole('navigation')).not.toBeInTheDocument();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.click(await page.findByRole('option', { name: 'Parent schema Version 8' }));
    expect(input).toHaveValue('Parent schema');
    fireEvent.change(dialog.getByRole('textbox', { name: /^Name/ }), { target: { value: 'Child' } });
    expect(dialog.queryByLabelText('Version')).not.toBeInTheDocument();
    expect(dialog.queryByLabelText('Effective date')).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(api.blueprints.createBlueprint).toHaveBeenCalledWith(expect.objectContaining({ parentBlueprintId: 8 }))
    );
  });

  it('requests the first ten parents when its keyword changes', async () => {
    const page = renderPage('/admin/configuration?tab=blueprints');
    await page.findByText('Standard schema');
    fireEvent.click(page.getByTestId('blueprints-add-button'));
    const dialog = within(page.getByRole('dialog'));
    fireEvent.change(dialog.getByRole('combobox', { name: 'Parent blueprint (optional)' }), {
      target: { value: 'Changed' }
    });
    await waitFor(() =>
      expect(api.blueprints.getBlueprints).toHaveBeenLastCalledWith(
        { keyword: 'Changed' },
        expect.objectContaining({ page: 1, limit: 10 })
      )
    );
  });

  it('edits only name and description for a published blueprint from the table', async () => {
    api.blueprints.getBlueprints.mockResolvedValue({
      blueprints: [{ ...blueprint, record_effective_date: '2000-01-01', parent_blueprint_id: 99 }],
      pagination
    });
    const page = renderPage('/admin/configuration?tab=blueprints');
    await page.findByText('Standard schema');
    fireEvent.click(page.getByTitle('Actions for Standard schema'));
    fireEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    const dialog = within(page.getByRole('dialog'));
    expect(dialog.queryByRole('combobox')).not.toBeInTheDocument();
    expect(dialog.getAllByRole('textbox')).toHaveLength(2);
    fireEvent.change(dialog.getByRole('textbox', { name: 'Name' }), { target: { value: 'Updated schema' } });
    fireEvent.change(dialog.getByRole('textbox', { name: 'Description' }), { target: { value: '' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.blueprints.updateBlueprint).toHaveBeenCalledWith(1, { name: 'Updated schema', description: null })
    );
  });

  it('shows parent search errors without offering stale results', async () => {
    api.blueprints.getBlueprints.mockImplementation(async (_filters) => {
      if (_filters.keyword === 'Parent') {
        throw new Error('Blueprint search unavailable');
      }
      return { blueprints: [blueprint], pagination };
    });
    const page = renderPage('/admin/configuration?tab=blueprints');
    await page.findByText('Standard schema');
    fireEvent.click(page.getByTestId('blueprints-add-button'));
    fireEvent.change(within(page.getByRole('dialog')).getByRole('combobox', { name: 'Parent blueprint (optional)' }), {
      target: { value: 'Parent' }
    });
    expect(await within(page.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
      'Blueprint search unavailable'
    );
  });

  it('keeps default blueprint actions enabled and explains restrictions in a snackbar', async () => {
    api.blueprints.getBlueprints.mockResolvedValue({ blueprints: [{ ...blueprint, is_default: true }], pagination });
    const page = renderPage('/admin/configuration?tab=blueprints');
    await page.findByText('Standard schema');
    fireEvent.click(page.getByTitle('Actions for Standard schema'));
    expect(page.getAllByRole('menuitem')[0]).toHaveTextContent('Set as default');
    expect(page.getByRole('menuitem', { name: 'Retire' })).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(page.getByRole('menuitem', { name: 'Retire' }));
    expect(await page.findByRole('alert')).toHaveTextContent('Cannot retire default blueprint');
    expect(api.blueprints.retireBlueprint).not.toHaveBeenCalled();
    fireEvent.click(page.getByTitle('Actions for Standard schema'));
    fireEvent.click(page.getByRole('menuitem', { name: 'Set as default' }));
    expect(await page.findByRole('alert')).toHaveTextContent('Blueprint is already the default');
    expect(api.blueprints.setDefaultBlueprint).not.toHaveBeenCalled();
  });

  it.each([
    { record_effective_date: null },
    { record_effective_date: '2999-01-01' },
    { record_end_date: '2020-01-01' }
  ])('keeps ineligible default actions visible and explains the restriction %j', async (state) => {
    api.blueprints.getBlueprints.mockResolvedValue({ blueprints: [{ ...blueprint, ...state }], pagination });
    const page = renderPage('/admin/configuration?tab=blueprints');
    await page.findByText('Standard schema');
    fireEvent.click(page.getByTitle('Actions for Standard schema'));
    expect(page.getAllByRole('menuitem')[0]).toHaveTextContent('Set as default');
    fireEvent.click(page.getByRole('menuitem', { name: 'Set as default' }));
    expect(await page.findByRole('alert')).toHaveTextContent('Only effective blueprints can be made default');
    expect(api.blueprints.setDefaultBlueprint).not.toHaveBeenCalled();
    if ('record_end_date' in state) {
      fireEvent.click(page.getByTitle('Actions for Standard schema'));
      fireEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
      expect(await page.findByRole('alert')).toHaveTextContent('Cannot edit a retired blueprint');
      expect(page.queryByRole('dialog')).toBeNull();
    }
  });

  it('offers setting the default first and requires confirmation before updating', async () => {
    const page = renderPage('/admin/configuration?tab=blueprints');
    await page.findByText('Standard schema');
    fireEvent.click(page.getByTitle('Actions for Standard schema'));
    expect(page.getAllByRole('menuitem')[0]).toHaveTextContent('Set as default');
    fireEvent.click(page.getByRole('menuitem', { name: 'Set as default' }));
    expect(api.blueprints.setDefaultBlueprint).not.toHaveBeenCalled();
    fireEvent.click(within(page.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(api.blueprints.setDefaultBlueprint).not.toHaveBeenCalled();
    fireEvent.click(page.getByTitle('Actions for Standard schema'));
    fireEvent.click(page.getByRole('menuitem', { name: 'Set as default' }));
    fireEvent.click(within(page.getByRole('dialog')).getByRole('button', { name: 'Set as default' }));
    await waitFor(() => expect(api.blueprints.setDefaultBlueprint).toHaveBeenCalledWith(blueprint.blueprint_id));
    await waitFor(() => expect(api.blueprints.getBlueprints).toHaveBeenCalledTimes(2));
  });

  it('shows server conflicts without claiming a default transition succeeded', async () => {
    api.blueprints.setDefaultBlueprint.mockRejectedValue(new Error('Only effective blueprints can be made default'));
    const page = renderPage('/admin/configuration?tab=blueprints');
    await page.findByText('Standard schema');
    fireEvent.click(page.getByTitle('Actions for Standard schema'));
    fireEvent.click(page.getByRole('menuitem', { name: 'Set as default' }));
    fireEvent.click(within(page.getByRole('dialog')).getByRole('button', { name: 'Set as default' }));
    expect(await page.findByRole('alert')).toHaveTextContent('Only effective blueprints');
    expect(api.blueprints.getBlueprints).toHaveBeenCalledTimes(1);
  });

  it('opens blueprint composition by clicking a row after pagination', async () => {
    const page = renderPage('/admin/configuration?tab=blueprints');
    expect(await page.findByText('Standard schema')).toBeVisible();
    expect(page.queryByRole('link', { name: 'Standard schema' })).not.toBeInTheDocument();
    fireEvent.click(page.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() =>
      expect(api.blueprints.getBlueprints).toHaveBeenLastCalledWith(
        { keyword: '' },
        expect.objectContaining({ page: 2, limit: 10 })
      )
    );
    fireEvent.click(await page.findByText('Schema description'));
    expect(await page.findByText('Blueprint composition page')).toBeVisible();
  });
});
