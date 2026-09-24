import { fireEvent, waitFor, within } from '@testing-library/react';
import { DialogContextProvider } from 'contexts/dialogContext';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { BlueprintPage } from './BlueprintPage';

vi.mock('hooks/useApi');

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
const api = {
  blueprints: { getBlueprint: vi.fn(), updateBlueprint: vi.fn(), publishBlueprint: vi.fn() }
};
const renderPage = (id = '1', tab = 'metadata') =>
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

  it('confirms publication and shows the confirmed effective date', async () => {
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
    fireEvent.click(page.getByRole('button', { name: 'Edit' }));
    expect(page.getByRole('dialog')).toHaveTextContent('Edit Blueprint');
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
    resolveBlueprint(blueprint);
    expect(await page.findByRole('heading', { name: 'Draft schema' })).toBeVisible();
    expect(page.queryByTestId('blueprint-skeleton')).not.toBeInTheDocument();
    expect(page.getByRole('tab', { name: 'Metadata' })).toBeVisible();
  });

  it('shows metadata errors without fetching composition', async () => {
    api.blueprints.getBlueprint.mockRejectedValue(new Error('Blueprint not found'));
    const page = renderPage();
    expect(await page.findByRole('alert')).toHaveTextContent('Blueprint not found');
    expect(await page.findByRole('tab', { name: 'Metadata' })).toBeVisible();
    expect(page.getByRole('link', { name: 'Blueprints' })).toBeVisible();
    expect(page.queryByTestId('blueprint-skeleton')).not.toBeInTheDocument();
  });
});
