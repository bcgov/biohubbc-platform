import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageSection } from 'components/section/PageSection';
import { IContributorCodeset } from 'interfaces/useContributorsApi.interface';
import { FormSubmissionValue, IFormSection } from 'interfaces/useFormsApi.interface';
import { Fragment } from 'react';
import { createFormSubmissionRow, IFormSubmissionRow } from '../formSubmissionRows';
import { FormSubmissionFieldInput } from './FormSubmissionFieldInput';

interface IFormSubmissionSectionProps {
  /** Form slug. */
  slug: string;
  /** Published section: one feature type and its fields. */
  section: IFormSection;
  /** The form contributor's codesets, for code fields. */
  codesetsById: Map<number, IContributorCodeset>;
  /** Rows entered so far: one per feature. */
  rows: IFormSubmissionRow[];
  /** Replaces the section's rows. */
  onRowsChange: (rows: IFormSubmissionRow[]) => void;
  /** Shows the rows without letting them change. */
  readOnly: boolean;
}

/**
 * One section of the form submission page, collecting features of one feature type as rows of typed field values. A
 * required section keeps at least one row; a section that does not allow multiple rows accepts at most one.
 *
 * @param {IFormSubmissionSectionProps} props
 * @returns {JSX.Element} Section and its rows.
 */
export const FormSubmissionSection = ({
  slug,
  section,
  codesetsById,
  rows,
  onRowsChange,
  readOnly
}: IFormSubmissionSectionProps) => {
  const minimumRows = section.required_value ? 1 : 0;
  const canAddRow = !readOnly && (section.allow_multiple || rows.length === 0);
  const canRemoveRow = !readOnly && rows.length > minimumRows;

  /**
   * Set one field value of one row.
   *
   * @param {string} sourceId Row to change.
   * @param {number} featurePropertyId Field to set.
   * @param {FormSubmissionValue} value Entered value.
   */
  const setValue = (sourceId: string, featurePropertyId: number, value: FormSubmissionValue) => {
    onRowsChange(
      rows.map((row) =>
        row.sourceId === sourceId ? { ...row, values: { ...row.values, [featurePropertyId]: value } } : row
      )
    );
  };

  return (
    <PageSection
      id={`form-submission-section-${section.feature_type_id}`}
      label={section.label}
      onAdd={canAddRow ? () => onRowsChange([...rows, createFormSubmissionRow()]) : undefined}
      addLabel="Add Row">
      {section.description && (
        <Typography variant="body2" color="text.secondary" px={2} pt={2}>
          {section.description}
        </Typography>
      )}
      {rows.length === 0 && (
        <Typography variant="body2" color="text.secondary" p={2}>
          No rows
        </Typography>
      )}
      {rows.map((row, index) => (
        <Fragment key={row.sourceId}>
          {index > 0 && <Divider />}
          <Stack direction="row" gap={1} p={2} alignItems="flex-start">
            <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap={2} flex={1}>
              {section.fields.map((field) => (
                <FormSubmissionFieldInput
                  key={field.feature_property_id}
                  slug={slug}
                  field={field}
                  codesetsById={codesetsById}
                  value={row.values[field.feature_property_id] ?? null}
                  onChange={(value) => setValue(row.sourceId, field.feature_property_id, value)}
                  readOnly={readOnly}
                />
              ))}
            </Box>
            {canRemoveRow && (
              <IconButton
                aria-label="Remove row"
                size="small"
                color="inherit"
                onClick={() => onRowsChange(rows.filter((item) => item.sourceId !== row.sourceId))}>
                <Icon path={mdiTrashCanOutline} size={0.8} />
              </IconButton>
            )}
          </Stack>
        </Fragment>
      ))}
    </PageSection>
  );
};
