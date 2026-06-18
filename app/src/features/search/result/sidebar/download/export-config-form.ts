import { EXPORT_CONFIG_VERSION, EXPORT_TYPE } from 'constants/export-config-constants';
import { DownloadFeatureType, ExportConfig } from 'interfaces/useDownloadExportApi.interface';
import type { IExportConfigFormValues } from './ConfigureExportForm';

/**
 * Convert form values into the wire `ExportConfig` sent to `POST /api/download/:id/export`.
 *
 * Strips UI-only empties so the payload matches the backend recipe shape exactly: `root_feature_type`
 * is dropped unless the mode is denormalized and a root was chosen, `merge_steps` is forced empty
 * outside denormalized mode, and an empty `output_columns` is dropped to `undefined` (its absence
 * means "all columns"). The backend hashes the recipe to dedupe identical exports, so an empty array
 * versus an absent optional field would hash differently and defeat dedupe — keeping the emitted
 * shape minimal keeps those hashes stable.
 */
export const buildExportConfig = (values: IExportConfigFormValues): ExportConfig => {
  const isDenormalized = values.mode === 'denormalized';

  const config: ExportConfig = {
    version: EXPORT_CONFIG_VERSION,
    export_type: EXPORT_TYPE,
    mode: values.mode,
    feature_types: values.feature_types,
    // Strip the UI-only `_key` (see IMergeStepFormValue) so the recipe shape — and
    // thus its dedupe hash — matches the backend's exactly.
    merge_steps: isDenormalized
      ? values.merge_steps.map((step) => ({
          left_feature_type: step.left_feature_type,
          left_column: step.left_column,
          right_feature_type: step.right_feature_type,
          right_column: step.right_column,
          merge_type: step.merge_type
        }))
      : []
  };

  if (isDenormalized && values.root_feature_type) {
    config.root_feature_type = values.root_feature_type;
  }

  if (values.output_columns.length > 0) {
    config.output_columns = values.output_columns;
  }

  return config;
};

/**
 * Existence-mirror of the backend column check: returns true when `column` is one of the loaded
 * `featureType`'s exportable columns.
 *
 * Defense-in-depth for the Yup schema: the pickers only offer valid columns, but this lets client
 * validation reject the same columns the server would, keeping the two validation surfaces in step.
 */
export const isColumnInFeatureType = (
  featureTypes: DownloadFeatureType[],
  featureType: string,
  column: string
): boolean => {
  const match = featureTypes.find((entry) => entry.feature_type === featureType);
  return Boolean(match?.columns.includes(column));
};
