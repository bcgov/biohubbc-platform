import { fireEvent, waitFor, within } from '@testing-library/react';
import { DownloadFeatureType } from 'interfaces/useDownloadExportApi.interface';
import { render } from 'test-helpers/test-utils';
import { buildConfigureExportDialogYup } from './ConfigureExportDialogYup';
import { ConfigureExportDialog } from './ConfigureExportDialog';

// Interaction-heavy MUI Autocomplete + Formik suite: each select re-renders the whole form, so the
// chained guided-merge interactions can exceed the default 5s ceiling on contended CI runners.
const interactionTimeout = 20000;
vi.setConfig({ testTimeout: interactionTimeout });

// Two feature types, each with three exportable columns. Shared parent_uuid lets a merge step join them.
const defaultFeatureTypes: DownloadFeatureType[] = [
  { feature_type: 'telemetry', columns: ['uuid', 'parent_uuid', 'vendor'] },
  { feature_type: 'deployment', columns: ['uuid', 'parent_uuid', 'device_id'] }
];

const renderDialog = (overrides: Partial<React.ComponentProps<typeof ConfigureExportDialog>> = {}) =>
  render(
    <ConfigureExportDialog
      open={true}
      isSubmitting={false}
      featureTypes={defaultFeatureTypes}
      onCancel={vi.fn()}
      onSave={vi.fn()}
      {...overrides}
    />
  );

/**
 * Select an option in the `feature_types` multi-select autocomplete by opening the popup (click +
 * ArrowDown), waiting for the listbox, and clicking the matching option. Mirrors the repo's
 * established multi-select interaction (TeamMemberSelect.test.tsx).
 */
const selectFeatureType = async (
  getByRole: (role: string, opts?: { name?: RegExp }) => HTMLElement,
  featureType: string
) => {
  const input = getByRole('combobox', { name: /Feature Types/i });
  fireEvent.click(input);
  fireEvent.keyDown(input, { key: 'ArrowDown' });

  await waitFor(() => {
    expect(getByRole('listbox')).toBeVisible();
  });

  const listbox = getByRole('listbox');
  fireEvent.click(within(listbox).getByText(featureType));
};

/**
 * Select the root feature type in the single-select autocomplete. The root options are restricted to
 * the already-selected feature types, so a feature type must be selected first.
 */
const selectRoot = async (getByRole: (role: string, opts?: { name?: RegExp }) => HTMLElement, featureType: string) => {
  const input = getByRole('combobox', { name: /Root Feature Type/i });
  fireEvent.click(input);
  fireEvent.keyDown(input, { key: 'ArrowDown' });

  await waitFor(() => {
    expect(getByRole('listbox')).toBeVisible();
  });

  fireEvent.click(within(getByRole('listbox')).getByText(featureType));
};

describe('ConfigureExportDialog', () => {
  describe('denormalized controls', () => {
    it('renders the root select and merge-step controls on open, with no mode toggle', async () => {
      // Verifies: the combined-CSV dialog is denormalized-only — the root single-select and the
      // merge-step FieldArray are always present, and the old per-type/flattened mode toggle is gone.
      const { getByTestId, queryByText } = renderDialog();

      expect(getByTestId('export-config-root-feature-type')).toBeInTheDocument();
      expect(getByTestId('add-merge-step')).toBeInTheDocument();

      // The mode toggle was removed — neither toggle label should render.
      expect(queryByText('One CSV per feature type')).toBeNull();
      expect(queryByText('Single flattened CSV')).toBeNull();
    });
  });

  describe('output column grouping', () => {
    it('groups Output Columns options by feature type so each selected type renders a group header', async () => {
      // Verifies: the grouped Autocomplete's `groupBy={(option) => option.feature_type}` decision. With
      // both types selected, the popup must render a group header per feature type. We assert the group
      // headers (our grouping data), not MUI's internal popup DOM structure.

      // Step 1: Render — both feature types are selected by default, so columns from both feed the picker
      const { getByRole } = renderDialog();

      // Step 2: Open the Output Columns autocomplete
      const outputColumnsInput = getByRole('combobox', { name: /Output Columns/i });
      fireEvent.click(outputColumnsInput);
      fireEvent.keyDown(outputColumnsInput, { key: 'ArrowDown' });

      // Step 3: The popup renders one group header per selected feature type (telemetry, deployment).
      // MUI renders group headers as elements with the `MuiAutocomplete-groupLabel` class.
      await waitFor(() => {
        const groupLabels = Array.from(document.querySelectorAll('.MuiAutocomplete-groupLabel')).map(
          (node) => node.textContent
        );
        expect(groupLabels).toEqual(expect.arrayContaining(['telemetry', 'deployment']));
      });
    });
  });

  describe('onSave', () => {
    it('passes the entered IExportConfigFormValues to onSave for a valid denormalized config', async () => {
      // Verifies: with feature types defaulted to all, choosing a root yields a valid combined config that
      // passes Yup, and the dialog forwards the exact form values to onSave. Asserts what the form DECIDED
      // to submit, not a mock.

      // Step 1: Render with a spy onSave
      const onSave = vi.fn();
      const { getByRole, getByTestId } = renderDialog({ onSave });

      // Step 2: Both feature types are selected by default — choose one as the root (always required)
      await selectRoot(getByRole, 'telemetry');

      // Step 3: Click the dialog Create button to submit
      fireEvent.click(getByTestId('edit-dialog-save-button'));

      // Step 4: onSave fires once with form values reflecting the entry: denormalized mode + all types + root
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'denormalized',
          feature_types: ['telemetry', 'deployment'],
          root_feature_type: 'telemetry'
        })
      );
    });
  });

  describe('merge step gating', () => {
    it('disables Add Merge Step when fewer than two feature types are selected', async () => {
      // Verifies: a merge step joins two chosen types, so the form gates `Add Merge Step` on
      // feature_types.length >= 2. This prevents an empty step whose type dropdowns have no options.

      // Step 1: Both feature types default in; once a root is chosen a merge is possible — button enabled.
      const { getByTestId, getByRole } = renderDialog();
      expect(getByTestId('add-merge-step')).toBeInTheDocument();
      await selectRoot(getByRole, 'telemetry');
      await waitFor(() => {
        expect(getByTestId('add-merge-step')).toBeEnabled();
      });

      // Step 2: Deselecting one type leaves a single type — nothing to join, so the button disables.
      await selectFeatureType(getByRole, 'deployment');
      await waitFor(() => {
        expect(getByTestId('add-merge-step')).toBeDisabled();
      });

      // Step 3: Reselecting the second type re-enables it.
      await selectFeatureType(getByRole, 'deployment');
      await waitFor(() => {
        expect(getByTestId('add-merge-step')).toBeEnabled();
      });
    });
  });

  describe('guided merge step', () => {
    it('renders the root as a chip, defaults a new step to the root, and suggests the star-schema join columns', async () => {
      // Verifies the biologist-friendly guidance: the root shows as a chip (parity with Feature Types),
      // a new step pre-fills "Start with" with the root, and choosing a type to join auto-fills the
      // platform star link (added.parent_uuid → root.uuid) plus a plain-language summary.
      const { getByRole, getByTestId, getByText } = renderDialog();

      // Step 1: Pick a root — it renders as a chip inside the root field.
      await selectRoot(getByRole, 'telemetry');
      expect(within(getByTestId('export-config-root-feature-type')).getByText('telemetry')).toBeVisible();

      // Step 2: Add a step — "Start with" is pre-filled with the root.
      fireEvent.click(getByTestId('add-merge-step'));
      await waitFor(() => {
        expect(getByRole('combobox', { name: /Start with/i })).toHaveValue('telemetry');
      });

      // Step 3: Choose the feature type to join. The root (telemetry) is NOT offered — you can't join a
      // type that's already in the result — so only the still-outside type (deployment) appears.
      const addInput = getByRole('combobox', { name: /^Join$/i });
      fireEvent.click(addInput);
      fireEvent.keyDown(addInput, { key: 'ArrowDown' });
      await waitFor(() => {
        expect(getByRole('listbox')).toBeVisible();
      });
      expect(within(getByRole('listbox')).queryByText('telemetry')).toBeNull();
      fireEvent.click(within(getByRole('listbox')).getByText('deployment'));

      // Step 4: The join columns are suggested (deployment.parent_uuid → telemetry.uuid).
      await waitFor(() => {
        expect(getByRole('combobox', { name: /^Match$/i })).toHaveValue('parent_uuid');
      });
      expect(getByRole('combobox', { name: /^to$/i })).toHaveValue('uuid');

      // Step 5: A plain-language summary of the step appears.
      expect(getByText(/Attaches each deployment record to its matching telemetry/i)).toBeVisible();
    });

    it('defaults a second step to link to the most-recently-added type, chaining deeper', async () => {
      // Verifies the chain default: once a type is added, the NEXT step links to it (not the root) by
      // default — so dataset → telemetry → animal builds without re-picking the link target each time.
      const threeTypes: DownloadFeatureType[] = [
        { feature_type: 'dataset', columns: ['uuid', 'parent_uuid', 'name'] },
        { feature_type: 'telemetry', columns: ['uuid', 'parent_uuid', 'vendor'] },
        { feature_type: 'animal', columns: ['uuid', 'parent_uuid', 'tag'] }
      ];
      const { getByRole, getByTestId } = renderDialog({ featureTypes: threeTypes });

      // Root = dataset.
      await selectRoot(getByRole, 'dataset');

      // Step 1: join telemetry (its "Start with" defaults to the root).
      fireEvent.click(getByTestId('add-merge-step'));
      const addInput = getByRole('combobox', { name: /^Join$/i });
      fireEvent.click(addInput);
      fireEvent.keyDown(addInput, { key: 'ArrowDown' });
      await waitFor(() => {
        expect(getByRole('listbox')).toBeVisible();
      });
      fireEvent.click(within(getByRole('listbox')).getByText('telemetry'));

      // Step 2: the new step's "Start with" defaults to telemetry (the last-added type), not the root.
      fireEvent.click(getByTestId('add-merge-step'));
      await waitFor(() => {
        expect(within(getByTestId('merge-step-1')).getByRole('combobox', { name: /Start with/i })).toHaveValue(
          'telemetry'
        );
      });
    });
  });

  describe('client validation', () => {
    it('blocks save when no root feature type is selected', async () => {
      // Verifies: the Yup `root_feature_type` required rule. The combined export always needs a root —
      // selecting a type but no root must fail validation, so onSave stays uncalled and the error shows.

      // Step 1: Render with a spy onSave. Feature types default to all, but no root is chosen yet.
      const onSave = vi.fn();
      const { getByText, getByTestId } = renderDialog({ onSave });

      // Step 2: Attempt to save with the root left empty
      fireEvent.click(getByTestId('edit-dialog-save-button'));

      // Step 3: The root-required validation message surfaces and onSave is never called
      await waitFor(() => {
        expect(getByText('Select a root feature type')).toBeVisible();
      });
      expect(onSave).not.toHaveBeenCalled();
    });

    it('rejects an output column that does not exist on its feature type (direct schema assertion)', async () => {
      // Verifies: the `output-column-exists` Yup test mirrors the backend column check — a recipe
      // referencing a column absent from the type is rejected. The picker only offers valid columns, so
      // an unknown column can't be produced through the UI; this asserts the schema directly as the
      // defense-in-depth that keeps the client and server validation surfaces in step.
      const schema = buildConfigureExportDialogYup(defaultFeatureTypes);

      // A valid-otherwise config (root set) selecting an output column ('not_a_real_column') telemetry lacks,
      // so the output-column existence check is the rule that fails (not the now-required root).
      const configWithUnknownColumn = {
        mode: 'denormalized',
        feature_types: ['telemetry'],
        root_feature_type: 'telemetry',
        merge_steps: [],
        output_columns: [{ feature_type: 'telemetry', column: 'not_a_real_column' }]
      };

      await expect(schema.validate(configWithUnknownColumn)).rejects.toThrow(
        'The output column does not exist on its feature type'
      );

      // Control: the same config with a real column ('uuid') passes validation
      await expect(
        schema.validate({
          ...configWithUnknownColumn,
          output_columns: [{ feature_type: 'telemetry', column: 'uuid' }]
        })
      ).resolves.toBeDefined();
    });
  });
});
