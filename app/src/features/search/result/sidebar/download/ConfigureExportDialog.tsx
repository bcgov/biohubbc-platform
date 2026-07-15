import { EditDialog } from 'components/dialog/EditDialog';
import { DownloadFeatureType } from 'interfaces/useDownloadExportApi.interface';
import { buildConfigureExportDialogYup } from './ConfigureExportDialogYup';
import { ConfigureExportForm, IExportConfigFormValues } from './ConfigureExportForm';

interface IConfigureExportDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Whether a config submit is in flight; disables the form and shows the loading state. */
  isSubmitting: boolean;
  /** Loaded feature types for the download being configured; passed through to the form and schema. */
  featureTypes: DownloadFeatureType[];
  /** Called when the user dismisses the dialog without submitting. */
  onCancel: () => void;
  /** Called with the entered form values when the user submits a valid config. */
  onSave: (values: IExportConfigFormValues) => void;
}

/**
 * Dialog wrapper for building a combined ("single flattened") CSV export. Thin layer over `EditDialog`
 * that wires the form and its Yup schema (built from the loaded feature types so column checks can run
 * client-side).
 *
 * Presentational: it neither loads the feature types nor runs the export. The owning page passes the
 * loaded types in and owns the submit lifecycle (in-flight flag, snackbars, refresh) through
 * `isSubmitting` and `onSave`.
 */
export const ConfigureExportDialog = (props: IConfigureExportDialogProps) => {
  const { open, isSubmitting, featureTypes, onCancel, onSave } = props;

  // Seed values for a fresh combined-CSV config. The dialog only builds the `denormalized` shape (the
  // per-feature-type export is a separate one-click menu item), so mode is fixed. Feature Types defaults
  // to every type the download materialized — a combined export almost always wants all available types
  // in scope to join. EditDialog's Formik runs with enableReinitialize, so this fills in once the
  // async-loaded featureTypes arrive and re-defaults when the dialog is reopened for another download.
  // Root and merge steps stay empty: the root (output grain) is a deliberate choice the user must make.
  const initialValues: IExportConfigFormValues = {
    mode: 'denormalized',
    feature_types: featureTypes.map((featureType) => featureType.feature_type),
    root_feature_type: '',
    merge_steps: [],
    output_columns: []
  };

  return (
    <EditDialog<IExportConfigFormValues>
      open={open}
      isLoading={isSubmitting}
      dialogTitle="Combined CSV Export"
      dialogSaveButtonLabel="Create"
      component={{
        element: <ConfigureExportForm featureTypes={featureTypes} />,
        initialValues,
        validationSchema: buildConfigureExportDialogYup(featureTypes)
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
