import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { FORM_CODES_PAGINATION } from 'constants/form';
import { useApi } from 'hooks/useApi';
import { IContributorCodeset, IContributorCodesetCode } from 'interfaces/useContributorsApi.interface';
import { IFormField } from 'interfaces/useFormsApi.interface';
import { formQueryKeys } from 'utils/query-keys/form-query-keys';
import { toCodeValue } from '../formSubmissionRows';

interface IFormSubmissionCodeFieldProps {
  /** Form slug. */
  slug: string;
  /** Code field. */
  field: IFormField;
  /** The field's codeset. */
  codeset: IContributorCodeset | undefined;
  /** Stored value: `code::<codeset key>::<code key>`. */
  value: string | null;
  /** Sets the stored value. */
  onChange: (value: string | null) => void;
  /** Disables the input. */
  disabled: boolean;
}

/**
 * Pick a code from a code field's codeset of the form's contributor. Stores the code as ingestion resolves it. Ended
 * codes are not offered.
 *
 * @param {IFormSubmissionCodeFieldProps} props
 * @returns {JSX.Element} Code picker.
 */
export const FormSubmissionCodeField = ({
  slug,
  field,
  codeset,
  value,
  onChange,
  disabled
}: IFormSubmissionCodeFieldProps) => {
  const biohubApi = useApi();
  const contributorCodesetId = Number(field.contributor_codeset_id);

  const codesQuery = useQuery({
    queryKey: formQueryKeys.codes(slug, contributorCodesetId, FORM_CODES_PAGINATION),
    queryFn: ({ signal }) =>
      biohubApi.forms.getFormCodesetCodes(slug, contributorCodesetId, FORM_CODES_PAGINATION, { signal }),
    enabled: field.contributor_codeset_id !== null
  });
  const codes = (codesQuery.data?.codes ?? []).filter((code) => !code.record_end_date);
  const selectedCode = codes.find((code) => codeset && toCodeValue(codeset.key, code.key) === value) ?? null;

  return (
    <>
      <QueryErrorDialog error={codesQuery.error} label="codes" />
      <Autocomplete<IContributorCodesetCode>
        size="small"
        fullWidth
        disabled={disabled || !codeset}
        options={codes}
        value={selectedCode}
        getOptionLabel={(code) => code.label}
        isOptionEqualToValue={(option, selected) =>
          option.contributor_codeset_code_id === selected.contributor_codeset_code_id
        }
        onChange={(_, code) => onChange(code && codeset ? toCodeValue(codeset.key, code.key) : null)}
        renderInput={(params) => (
          <TextField {...params} label={field.label} helperText={field.description ?? codeset?.label} />
        )}
      />
    </>
  );
};
