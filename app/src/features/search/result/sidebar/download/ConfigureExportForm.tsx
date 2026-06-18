import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CustomAutocompleteFormik from 'components/fields/CustomAutocompleteFormik';
import { CustomMultiAutocompleteFormik } from 'components/fields/CustomMultiAutocompleteFormik';
import { ExportMode } from 'constants/export-config-constants';
import { FieldArray, getIn, useFormikContext } from 'formik';
import { DownloadFeatureType, MergeStep, OutputColumn } from 'interfaces/useDownloadExportApi.interface';

/**
 * Formik values for the custom CSV export config.
 *
 * Differs from the wire `ExportConfig` on purpose: every optional/absent field on the wire
 * (`root_feature_type`, `merge_steps`, `output_columns`) is always present here as a non-optional
 * `''`/`[]` so the form controls bind to stable, defined values and React never flips a field
 * between controlled and uncontrolled. The form→wire conversion (`buildExportConfig`) drops the
 * UI-only empties back out.
 */
export interface IExportConfigFormValues {
  /**
   * Always `denormalized` — this dialog builds a single combined CSV. The per-feature-type shape is
   * the separate one-click menu item, not this form. Kept on the values so the wire `mode` field has
   * a 1:1 source and the recipe stays self-describing.
   */
  mode: ExportMode;
  /** Feature types to include in the combined export; at least one is required. */
  feature_types: string[];
  /** The feature type the merge chain joins outward from (`''` until chosen). */
  root_feature_type: string;
  /** Ordered join steps building the single combined table. */
  merge_steps: IMergeStepFormValue[];
  /** Columns to emit; empty means "all columns" for every selected feature type. */
  output_columns: OutputColumn[];
}

interface IConfigureExportFormProps {
  /** Loaded feature types for the open download — drives the pickers and column options. */
  featureTypes: DownloadFeatureType[];
}

/**
 * One row in the grouped output-column picker. Carries the feature type so the grouped MUI
 * Autocomplete can `groupBy` on it and so the selection round-trips to `OutputColumn` objects —
 * the shared `CustomMultiAutocompleteFormik` can't, because its option value is a single primitive.
 */
interface IOutputColumnOption {
  feature_type: string;
  column: string;
  label: string;
}

const EMPTY_MERGE_STEP: MergeStep = {
  left_feature_type: '',
  left_column: '',
  right_feature_type: '',
  right_column: '',
  merge_type: 'left'
};

/**
 * A merge step plus a stable UI-only `_key` so React keeps each row's identity across a
 * mid-list removal (an array index would shift and reattach field state to the wrong row).
 * The key never leaves the form — `buildExportConfig` strips it before the recipe is sent.
 */
export interface IMergeStepFormValue extends MergeStep {
  _key: string;
}

let mergeStepKeySeq = 0;

/** A new merge-step row carrying a fresh stable `_key`. */
const newMergeStep = (overrides: Partial<MergeStep> = {}): IMergeStepFormValue => ({
  ...EMPTY_MERGE_STEP,
  ...overrides,
  _key: `merge-step-${(mergeStepKeySeq += 1)}`
});

/**
 * Form body for the combined ("single flattened") CSV export. Presentational only — it reads/writes
 * Formik state and receives the loaded feature types as a prop; the owning page handles loading,
 * submit, and refresh.
 *
 * This form builds only the denormalized recipe (a root feature type joined to others via ordered
 * merge steps into one CSV). The per-feature-type shape lives behind a separate one-click menu item,
 * so there is no mode toggle here. Every control is constrained to the loaded feature types and their
 * columns, so the form can only build recipes the backend will accept — there is no raw-JSON escape
 * hatch, which would expose an admin-grade affordance and let users submit malformed recipes.
 */
export const ConfigureExportForm = (props: IConfigureExportFormProps) => {
  const { featureTypes } = props;
  const { values, setValues, setFieldValue, touched, errors, submitCount } =
    useFormikContext<IExportConfigFormValues>();

  const featureTypeOptions = featureTypes.map((featureType) => ({
    value: featureType.feature_type,
    label: featureType.feature_type
  }));

  // Single-select options restricted to the types the user has already chosen.
  const selectedFeatureTypeOptions = values.feature_types.map((featureType) => ({
    value: featureType,
    label: featureType
  }));

  const columnsForFeatureType = (featureType: string): { value: string; label: string }[] => {
    const match = featureTypes.find((entry) => entry.feature_type === featureType);
    return (match?.columns ?? []).map((column) => ({ value: column, label: column }));
  };

  // Cross-product of every selected type's columns, grouped by feature type for the output picker.
  const outputColumnOptions: IOutputColumnOption[] = values.feature_types.flatMap((featureType) => {
    const match = featureTypes.find((entry) => entry.feature_type === featureType);
    return (match?.columns ?? []).map((column) => ({
      feature_type: featureType,
      column,
      label: `${featureType}.${column}`
    }));
  });

  const selectedOutputColumnOptions = outputColumnOptions.filter((option) =>
    values.output_columns.some(
      (outputColumn) => outputColumn.feature_type === option.feature_type && outputColumn.column === option.column
    )
  );

  // A step combines two chosen types and must hang off the root, so steps need a root plus a second
  // type to add. Adding steps before a root is set would let a user build a chain that can't reach it.
  const canAddMergeStep = values.feature_types.length >= 2 && Boolean(values.root_feature_type);

  const columnNamesForType = (featureType: string): string[] =>
    featureTypes.find((entry) => entry.feature_type === featureType)?.columns ?? [];

  // Types already in the result before/after this step (the root plus types other steps add). The
  // result grows one type per step, so each type is added at most once and is linked to something
  // already present.
  const typesAddedByOtherSteps = (index: number): string[] =>
    values.merge_steps
      .filter((_step, i) => i !== index)
      .map((step) => step.right_feature_type)
      .filter(Boolean);

  /**
   * Options for "Add feature type": a selected type that isn't already in the result (not the root,
   * not added by another step) — you can only bring in a type that's still outside the combined table.
   */
  const addableTypeOptions = (index: number): { value: string; label: string }[] => {
    const inResult = new Set([values.root_feature_type, ...typesAddedByOtherSteps(index)]);
    return values.feature_types.filter((type) => !inResult.has(type)).map((type) => ({ value: type, label: type }));
  };

  /**
   * Options for "Start with": a type already in the result (the root, or a type another step adds) —
   * the new type must join onto something the combined table already has, so the chain reaches the root.
   */
  const linkToTypeOptions = (index: number): { value: string; label: string }[] => {
    const inResult = [values.root_feature_type, ...typesAddedByOtherSteps(index)].filter(Boolean);
    return Array.from(new Set(inResult)).map((type) => ({ value: type, label: type }));
  };

  /**
   * Pre-fill a step's join columns with the platform star link as soon as both feature types are
   * chosen: a child record points at its parent through `parent_uuid`, and parents are identified by
   * `uuid`. Only fills blanks, so a column the user has already picked is never overwritten. This is
   * the "hint at the next step" — the common biology join is suggested, not imposed.
   */
  const suggestJoinColumns = (index: number, linkToType: string, addedType: string) => {
    if (!linkToType || !addedType) {
      return;
    }
    if (columnNamesForType(linkToType).includes('uuid') && columnNamesForType(addedType).includes('parent_uuid')) {
      if (!getIn(values, `merge_steps.${index}.left_column`)) {
        setFieldValue(`merge_steps.${index}.left_column`, 'uuid');
      }
      if (!getIn(values, `merge_steps.${index}.right_column`)) {
        setFieldValue(`merge_steps.${index}.right_column`, 'parent_uuid');
      }
    }
  };

  /** Plain-language summary of a step, shown once both feature types are chosen. */
  const describeStep = (step: MergeStep): string | null =>
    step.right_feature_type && step.left_feature_type
      ? `Attaches each ${step.right_feature_type} record to its matching ${step.left_feature_type}.`
      : null;

  const rootError =
    getIn(touched, 'root_feature_type') || submitCount > 0
      ? (getIn(errors, 'root_feature_type') as string | undefined)
      : undefined;

  return (
    <Stack gap={3} sx={{ pt: 1, minWidth: { xs: 300, sm: 640 } }}>
      <CustomMultiAutocompleteFormik
        id="feature_types"
        name="feature_types"
        label="Feature Types"
        required
        chipVisible
        options={featureTypeOptions}
      />

      <Box data-testid="export-config-root-feature-type">
        <Autocomplete<{ value: string; label: string }, true, false, false>
          multiple
          id="root_feature_type"
          options={selectedFeatureTypeOptions}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.value === value.value}
          value={values.root_feature_type ? [{ value: values.root_feature_type, label: values.root_feature_type }] : []}
          onChange={(_event, nextOptions) => {
            // Single-select rendered as a chip for visual parity with Feature Types: keep only the
            // most recently chosen type, so picking a new root replaces the old one.
            const chosen = nextOptions.length ? nextOptions[nextOptions.length - 1] : null;
            setFieldValue('root_feature_type', chosen?.value ?? '');
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Root Feature Type"
              required
              error={Boolean(rootError)}
              helperText={rootError}
              InputLabelProps={{ shrink: true }}
            />
          )}
        />
      </Box>

      <FieldArray
        name="merge_steps"
        render={(arrayHelpers) => (
          <Stack gap={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Combine feature types
            </Typography>
            {values.merge_steps.map((mergeStep, index) => {
              const linkToType = getIn(values, `merge_steps.${index}.left_feature_type`) as string;
              const addedType = getIn(values, `merge_steps.${index}.right_feature_type`) as string;
              const preview = describeStep(mergeStep);

              return (
                <Box
                  key={mergeStep._key}
                  data-testid={`merge-step-${index}`}
                  sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Step {index + 1}
                    </Typography>
                    <IconButton
                      aria-label="Remove merge step"
                      onClick={() => arrayHelpers.remove(index)}
                      data-testid={`remove-merge-step-${index}`}
                      size="small">
                      <Icon path={mdiClose} size={0.75} />
                    </IconButton>
                  </Stack>

                  <Stack gap={2}>
                    {/* Top-down, existing-thing-first: the feature you already have (the root or last-added
                        type, usually pre-filled) sits on top; the feature you join onto it follows below. You
                        read what's already there, then what you add to it. The top label is a plain value, not a
                        trailing preposition, so it reads as a complete field instead of a dangling fragment.
                        autoFocus is on "Join" — the top field is usually pre-filled, so the join is the one that
                        actually needs input. (Under the hood the top binds to the LEFT/kept side of the join and
                        "Join" to the RIGHT/added side; the UI order is intentionally the reverse of that.) */}
                    <CustomAutocompleteFormik
                      id={`merge_steps.${index}.left_feature_type`}
                      name={`merge_steps.${index}.left_feature_type`}
                      label="Start with"
                      placeholder="Select a feature to start with"
                      options={linkToTypeOptions(index)}
                      onChange={(_event, option) => suggestJoinColumns(index, option?.value ?? '', addedType)}
                    />
                    <CustomAutocompleteFormik
                      id={`merge_steps.${index}.right_feature_type`}
                      name={`merge_steps.${index}.right_feature_type`}
                      label="Join"
                      placeholder="Select a feature to join"
                      autoFocus
                      options={addableTypeOptions(index)}
                      onChange={(_event, option) => suggestJoinColumns(index, linkToType, option?.value ?? '')}
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
                      <Box sx={{ flex: 1 }}>
                        <CustomAutocompleteFormik
                          id={`merge_steps.${index}.right_column`}
                          name={`merge_steps.${index}.right_column`}
                          label="Match"
                          placeholder="Select a column"
                          options={columnsForFeatureType(addedType)}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
                          {addedType ? `in ${addedType}` : 'in the added feature type'}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <CustomAutocompleteFormik
                          id={`merge_steps.${index}.left_column`}
                          name={`merge_steps.${index}.left_column`}
                          label="to"
                          placeholder="Select a column"
                          options={columnsForFeatureType(linkToType)}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
                          {linkToType ? `in ${linkToType}` : 'in the linked feature type'}
                        </Typography>
                      </Box>
                    </Stack>

                    {preview ? (
                      <>
                        <Divider />
                        <Typography variant="body2" color="text.secondary">
                          ✓ {preview}
                        </Typography>
                      </>
                    ) : null}
                  </Stack>
                </Box>
              );
            })}
            <Box>
              <Button
                variant="outlined"
                onClick={() => {
                  // Default "Start with" to the most-recently-added type so deeper chains build
                  // naturally (dataset → telemetry → animal); fall back to the root for the first step.
                  const lastAddedType = values.merge_steps[values.merge_steps.length - 1]?.right_feature_type;
                  arrayHelpers.push(newMergeStep({ left_feature_type: lastAddedType || values.root_feature_type }));
                }}
                data-testid="add-merge-step"
                disabled={!canAddMergeStep}
                sx={{ alignSelf: 'flex-start' }}>
                Add another feature type
              </Button>
              {canAddMergeStep ? null : (
                <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                  Choose a root feature type and at least two feature types to combine them.
                </Typography>
              )}
            </Box>
          </Stack>
        )}
      />

      <Autocomplete<IOutputColumnOption, true, false, false>
        multiple
        disableCloseOnSelect
        options={outputColumnOptions}
        groupBy={(option) => option.feature_type}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) =>
          option.feature_type === value.feature_type && option.column === value.column
        }
        value={selectedOutputColumnOptions}
        onChange={(_event, nextOptions) => {
          const nextOutputColumns: OutputColumn[] = nextOptions.map((option) => ({
            feature_type: option.feature_type,
            column: option.column
          }));
          setValues({ ...values, output_columns: nextOutputColumns });
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Output Columns"
            helperText="Leave empty to include all columns"
            InputLabelProps={{ shrink: true }}
          />
        )}
      />
    </Stack>
  );
};
