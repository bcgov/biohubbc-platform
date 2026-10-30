import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { FORM_CODES_PAGINATION } from 'constants/form';
import { useApi } from 'hooks/useApi';
import { IFormLayoutField } from '../formLayout';

interface IFormFieldConfigContentProps {
  /** Contributor that owns the form, whose codesets a code field draws from. Null until chosen. */
  contributorId: number | null;
  /** Field being configured. */
  field: IFormLayoutField;
  /** Applies a change to the field's presentation. */
  onChange: (changes: Partial<IFormLayoutField>) => void;
  /** Disables every input for a published form. */
  readOnly: boolean;
}

/**
 * Config tab of the form builder's configuration panel for a field: its display label and description and, for a
 * code field, the codeset of the form's contributor whose codes it accepts. Ended codesets are not offered.
 *
 * @param {IFormFieldConfigContentProps} props
 * @returns {JSX.Element} Field configuration inputs.
 */
export const FormFieldConfigContent = ({ contributorId, field, onChange, readOnly }: IFormFieldConfigContentProps) => {
  const biohubApi = useApi();
  const isCodeField = field.typeName === 'code';

  const codesetsQuery = useQuery({
    queryKey: ['forms', 'contributorCodesets', contributorId],
    queryFn: () => biohubApi.contributors.listContributorCodesets(Number(contributorId), FORM_CODES_PAGINATION),
    enabled: isCodeField && contributorId !== null
  });
  const codesets = (codesetsQuery.data?.codesets ?? []).filter((codeset) => !codeset.record_end_date);

  return (
    <Stack gap={2} p={2}>
      <QueryErrorDialog error={codesetsQuery.error} label="codesets" />
      <TextField
        label="Label"
        size="small"
        fullWidth
        required
        disabled={readOnly}
        value={field.label}
        onChange={(event) => onChange({ label: event.target.value })}
      />
      <TextField
        label="Description"
        size="small"
        fullWidth
        multiline
        rows={3}
        disabled={readOnly}
        value={field.description ?? ''}
        onChange={(event) => onChange({ description: event.target.value || null })}
      />
      {isCodeField && (
        <TextField
          select
          label="Codeset"
          size="small"
          fullWidth
          required
          disabled={readOnly || contributorId === null}
          value={field.contributorCodesetId ?? ''}
          onChange={(event) => onChange({ contributorCodesetId: Number(event.target.value) })}>
          {codesets.map((codeset) => (
            <MenuItem key={codeset.contributor_codeset_id} value={codeset.contributor_codeset_id}>
              {codeset.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    </Stack>
  );
};
