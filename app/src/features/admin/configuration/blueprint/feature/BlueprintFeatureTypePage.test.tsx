import { fireEvent, waitFor, within } from '@testing-library/react';
import { DialogContextProvider } from 'contexts/dialogContext';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { BlueprintFeatureTypePage } from './BlueprintFeatureTypePage';

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
  blueprints: { getBlueprint: vi.fn(), publishBlueprint: vi.fn() },
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
const renderPage = (assignmentId = '2') =>
  render(
    <DialogContextProvider>
      <MemoryRouter initialEntries={[`/admin/configuration/blueprints/1/feature_type/${assignmentId}`]}>
        <Routes>
          <Route
            path="/admin/configuration/blueprints/:blueprintId/feature_type/:blueprintFeatureTypeId"
            element={<BlueprintFeatureTypePage />}
          />
        </Routes>
      </MemoryRouter>
    </DialogContextProvider>
  );
describe('Blueprint feature type properties', () => {
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
  it('keeps membership identity out of edit forms and preserves explicit false', async () => {
    const page = renderPage();
    await page.findByText('Property description');
    fireEvent.click(page.getByTitle('Actions for height'));
    fireEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    const dialog = within(page.getByRole('dialog'));
    expect(dialog.queryByRole('combobox')).toBeNull();
    fireEvent.click(dialog.getByRole('checkbox', { name: 'Allow multiple' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.blueprintFeatureTypeProperties.updateBlueprintFeatureTypeProperty).toHaveBeenCalledWith(1, 4, {
        requiredValue: false,
        allowMultiple: true
      })
    );
  });
  it('loads scoped metadata, breadcrumbs and server pagination', async () => {
    const page = renderPage();
    expect(page.getByTestId('blueprint-skeleton')).toBeVisible();
    expect(await page.findByText('Property description')).toBeVisible();
    expect(page.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Properties']);
    expect(page.getByRole('link', { name: 'Draft schema' })).toHaveAttribute(
      'href',
      '/admin/configuration/blueprints/1'
    );
    fireEvent.click(page.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() =>
      expect(api.blueprintFeatureTypeProperties.getBlueprintFeatureTypeProperties).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ blueprintFeatureTypeId: 2, page: 2 })
      )
    );
  });

  it('selects multiple properties as removable cards and saves only the remaining choices', async () => {
    api.featureProperties.getAvailableFeaturePropertiesForBlueprintFeatureType.mockResolvedValue({
      options: [
        { id: 5, name: 'height', display_name: 'Height' },
        { id: 6, name: 'width', display_name: 'Width' },
        { id: 7, name: 'length', display_name: 'Length' }
      ],
      pagination
    });
    const page = renderPage();
    await page.findByText('Property description');
    fireEvent.click(page.getByTestId('blueprint-properties-add-button'));
    const dialog = within(page.getByRole('dialog'));
    const input = dialog.getByRole('combobox', { name: 'Search properties' });
    expect(dialog.queryByRole('checkbox')).toBeNull();
    for (const label of ['height', 'width', 'length']) {
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.click(await page.findByRole('option', { name: label }));
    }
    fireEvent.click(dialog.getByRole('button', { name: 'Remove width' }));
    expect(dialog.queryByText('width')).not.toBeInTheDocument();
    expect(api.blueprintFeatureTypeProperties.createBlueprintFeatureTypeProperty).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.blueprintFeatureTypeProperties.createBlueprintFeatureTypeProperty).toHaveBeenCalledTimes(2)
    );
    expect(api.blueprintFeatureTypeProperties.createBlueprintFeatureTypeProperty).toHaveBeenNthCalledWith(1, 1, {
      blueprintFeatureTypeId: 2,
      featurePropertyId: 5
    });
    expect(api.blueprintFeatureTypeProperties.createBlueprintFeatureTypeProperty).toHaveBeenNthCalledWith(2, 1, {
      blueprintFeatureTypeId: 2,
      featurePropertyId: 7
    });
  });

  it('retains only unsaved selections after a partial failure and retries without duplicates', async () => {
    api.featureProperties.getAvailableFeaturePropertiesForBlueprintFeatureType.mockResolvedValue({
      options: [
        { id: 5, name: 'height', display_name: 'Height' },
        { id: 6, name: 'width', display_name: 'Width' }
      ],
      pagination
    });
    api.blueprintFeatureTypeProperties.createBlueprintFeatureTypeProperty
      .mockResolvedValueOnce(property)
      .mockRejectedValueOnce(new Error('Assignment failed'))
      .mockResolvedValueOnce(property);
    const page = renderPage();
    await page.findByText('Property description');
    fireEvent.click(page.getByTestId('blueprint-properties-add-button'));
    const dialog = within(page.getByRole('dialog'));
    const input = dialog.getByRole('combobox');
    for (const label of ['height', 'width']) {
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.click(await page.findByRole('option', { name: label }));
    }
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Assignment failed')).toBeVisible();
    expect(dialog.queryByRole('button', { name: 'Remove height' })).not.toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Remove width' })).toBeVisible();
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(page.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.blueprintFeatureTypeProperties.createBlueprintFeatureTypeProperty).toHaveBeenCalledTimes(3);
    expect(api.blueprintFeatureTypeProperties.createBlueprintFeatureTypeProperty).toHaveBeenLastCalledWith(1, {
      blueprintFeatureTypeId: 2,
      featurePropertyId: 6
    });
  });

  it('searches the top ten contextual property options without pagination controls', async () => {
    const page = renderPage();
    await page.findByText('Property description');
    fireEvent.click(page.getByTestId('blueprint-properties-add-button'));
    const dialog = within(page.getByRole('dialog'));
    expect(dialog.queryByRole('navigation')).not.toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: /page/i })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(api.featureProperties.getAvailableFeaturePropertiesForBlueprintFeatureType).toHaveBeenLastCalledWith(
        1,
        2,
        { keyword: '', page: 1, limit: 10, sort: 'name', order: 'asc' }
      )
    );
    fireEvent.change(dialog.getByRole('combobox'), { target: { value: 'height' } });
    await waitFor(() =>
      expect(api.featureProperties.getAvailableFeaturePropertiesForBlueprintFeatureType).toHaveBeenLastCalledWith(
        1,
        2,
        { keyword: 'height', page: 1, limit: 10, sort: 'name', order: 'asc' }
      )
    );
  });

  it('shows missing assignment errors without loading properties', async () => {
    api.blueprintFeatureTypes.getBlueprintFeatureType.mockRejectedValue(new Error('Assignment not found'));
    const page = renderPage();
    expect(await page.findByRole('alert')).toHaveTextContent('Assignment not found');
    expect(await page.findByRole('tab', { name: 'Properties' })).toBeVisible();
    expect(page.getByRole('link', { name: 'Blueprints' })).toBeVisible();
    expect(page.queryByText('Back to blueprint')).not.toBeInTheDocument();
    expect(page.queryByTestId('blueprint-skeleton')).not.toBeInTheDocument();
    expect(api.blueprintFeatureTypeProperties.getBlueprintFeatureTypeProperties).not.toHaveBeenCalled();
  });

  it.each([{ record_effective_date: '2000-01-01' }, { record_end_date: '2020-01-01' }])(
    'hides Assign for a read-only blueprint %j',
    async (state) => {
      api.blueprints.getBlueprint.mockResolvedValue({ ...blueprint, ...state });
      const page = renderPage();
      await page.findByText('Property description');
      expect(page.queryByTestId('blueprint-properties-add-button')).not.toBeInTheDocument();
    }
  );

  it('treats properties of a deleted feature type as read-only', async () => {
    api.blueprintFeatureTypes.getBlueprintFeatureType.mockResolvedValue({ ...type, record_end_date: '2000-01-01' });
    const page = renderPage();
    await page.findByText('Property description');
    expect(page.queryByTestId('blueprint-properties-add-button')).not.toBeInTheDocument();
    fireEvent.click(page.getByTitle('Actions for height'));
    fireEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    expect(await page.findByRole('alert')).toHaveTextContent('This section is read-only');
    expect(page.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
