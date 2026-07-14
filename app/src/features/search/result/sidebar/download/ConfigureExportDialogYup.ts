import { EXPORT_MODES, MERGE_TYPES } from 'constants/export-config-constants';
import { DownloadFeatureType } from 'interfaces/useDownloadExportApi.interface';
import yup from 'utils/YupSchema';
import { isColumnInFeatureType } from './export-config-form';

/**
 * Builds the validation schema for the custom CSV export dialog.
 *
 * Implemented as a factory so the cross-field existence checks can close over the loaded
 * `DownloadFeatureType[]` (each type's exportable columns) without the schema reaching for a hook or
 * global — every column referenced by a merge step or output column must exist on its feature type,
 * which is data the schema can't know statically. Mirrors the backend recipe validation so the
 * client rejects the same shapes the server would, surfacing errors in the dialog instead of after a
 * failed export.
 */
export const buildConfigureExportDialogYup = (featureTypes: DownloadFeatureType[]) =>
  yup.object().shape({
    mode: yup
      .string()
      .oneOf([...EXPORT_MODES], 'Select an export mode')
      .required('Select an export mode'),
    feature_types: yup
      .array()
      .of(yup.string().required('Feature type is required'))
      .min(1, 'Select at least one feature type')
      .required('Select at least one feature type'),
    // The combined export always joins outward from a root, so a root is always required and must be
    // one of the selected feature types.
    root_feature_type: yup
      .string()
      .required('Select a root feature type')
      .test(
        'root-in-selected-types',
        'The root feature type must be one of the selected feature types',
        function (value) {
          const selected: string[] = this.parent.feature_types ?? [];
          return Boolean(value) && selected.includes(value as string);
        }
      ),
    merge_steps: yup.array().of(
      yup.object().shape({
        left_feature_type: yup.string().required('Select a left feature type'),
        left_column: yup
          .string()
          .required('Select a left column')
          .test('left-column-exists', 'The left column does not exist on its feature type', function (value) {
            return isColumnInFeatureType(featureTypes, this.parent.left_feature_type, value as string);
          }),
        right_feature_type: yup.string().required('Select a right feature type'),
        right_column: yup
          .string()
          .required('Select a right column')
          .test('right-column-exists', 'The right column does not exist on its feature type', function (value) {
            return isColumnInFeatureType(featureTypes, this.parent.right_feature_type, value as string);
          }),
        merge_type: yup
          .string()
          .oneOf([...MERGE_TYPES], 'Only left joins are supported')
          .required('Merge type is required')
      })
    ),
    output_columns: yup
      .array()
      .of(
        yup.object().shape({
          feature_type: yup.string().required('Output column feature type is required'),
          column: yup
            .string()
            .required('Output column is required')
            .test('output-column-exists', 'The output column does not exist on its feature type', function (value) {
              return isColumnInFeatureType(featureTypes, this.parent.feature_type, value as string);
            }),
          output_column: yup.string()
        })
      )
      .test(
        'output-columns-from-selected-types',
        'Every output column must belong to a selected feature type',
        function (value) {
          const selected: string[] = this.parent.feature_types ?? [];
          return (value ?? []).every((outputColumn) => selected.includes(outputColumn.feature_type));
        }
      )
  });
