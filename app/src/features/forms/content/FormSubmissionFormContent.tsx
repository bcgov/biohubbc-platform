import Stack from '@mui/material/Stack';
import { useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { FORM_CODES_PAGINATION } from 'constants/form';
import { useApi } from 'hooks/useApi';
import { IFormSection } from 'interfaces/useFormsApi.interface';
import { formQueryKeys } from 'utils/query-keys/form-query-keys';
import { IFormSubmissionRow } from '../formSubmissionRows';
import { FormSubmissionSection } from '../section/FormSubmissionSection';

interface IFormSubmissionFormContentProps {
  /** Form slug. */
  slug: string;
  /** Published form sections, in display order. */
  sections: IFormSection[];
  /** Rows entered so far, keyed by feature type. */
  rowsByFeatureTypeId: Record<number, IFormSubmissionRow[]>;
  /** Replaces the rows of one section. */
  onRowsChange: (featureTypeId: number, rows: IFormSubmissionRow[]) => void;
  /** Shows the rows without letting them change. */
  readOnly: boolean;
}

/**
 * Form tab of the form submission page: every section of the form in display order, each collecting the features of
 * one feature type. Loads the form contributor's codesets once for its code fields.
 *
 * @param {IFormSubmissionFormContentProps} props
 * @returns {JSX.Element} Form sections.
 */
export const FormSubmissionFormContent = ({
  slug,
  sections,
  rowsByFeatureTypeId,
  onRowsChange,
  readOnly
}: IFormSubmissionFormContentProps) => {
  const biohubApi = useApi();
  const hasCodeField = sections.some((section) => section.fields.some((field) => field.type_name === 'code'));

  const codesetsQuery = useQuery({
    queryKey: formQueryKeys.codesets(slug, FORM_CODES_PAGINATION),
    queryFn: ({ signal }) => biohubApi.forms.getFormCodesets(slug, FORM_CODES_PAGINATION, { signal }),
    enabled: hasCodeField
  });
  const codesetsById = new Map(
    (codesetsQuery.data?.codesets ?? []).map((codeset) => [codeset.contributor_codeset_id, codeset])
  );

  return (
    <Stack gap={3}>
      <QueryErrorDialog error={codesetsQuery.error} label="codesets" />
      {sections.map((section) => (
        <FormSubmissionSection
          key={section.feature_type_id}
          slug={slug}
          section={section}
          codesetsById={codesetsById}
          rows={rowsByFeatureTypeId[section.feature_type_id] ?? []}
          onRowsChange={(rows) => onRowsChange(section.feature_type_id, rows)}
          readOnly={readOnly}
        />
      ))}
    </Stack>
  );
};
