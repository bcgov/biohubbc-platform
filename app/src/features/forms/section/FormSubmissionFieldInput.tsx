import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import { IContributorCodeset } from 'interfaces/useContributorsApi.interface';
import { FormSubmissionValue, IFormField } from 'interfaces/useFormsApi.interface';
import { FormSubmissionCodeField } from './FormSubmissionCodeField';

interface IFormSubmissionFieldInputProps {
  /** Form slug. */
  slug: string;
  /** Field the value is entered in. */
  field: IFormField;
  /** The form contributor's codesets, for code fields. */
  codesetsById: Map<number, IContributorCodeset>;
  /** Entered value. */
  value: FormSubmissionValue;
  /** Sets the entered value. */
  onChange: (value: FormSubmissionValue) => void;
  /** Disables the input. */
  readOnly: boolean;
}

/**
 * Input for one field of a form submission row, typed by the field's property type: text, multi-line text, number,
 * true or false, date and time, or a code from the field's codeset.
 *
 * @param {IFormSubmissionFieldInputProps} props
 * @returns {JSX.Element} Typed field input.
 */
export const FormSubmissionFieldInput = ({
  slug,
  field,
  codesetsById,
  value,
  onChange,
  readOnly
}: IFormSubmissionFieldInputProps) => {
  const helperText = field.description ?? undefined;

  if (field.type_name === 'boolean') {
    return (
      <FormControlLabel
        label={field.label}
        disabled={readOnly}
        control={<Checkbox checked={value === true} onChange={(event) => onChange(event.target.checked)} />}
      />
    );
  }

  if (field.type_name === 'code') {
    return (
      <FormSubmissionCodeField
        slug={slug}
        field={field}
        codeset={codesetsById.get(Number(field.contributor_codeset_id))}
        value={typeof value === 'string' ? value : null}
        onChange={onChange}
        disabled={readOnly}
      />
    );
  }

  if (field.type_name === 'number') {
    return (
      <TextField
        size="small"
        fullWidth
        type="number"
        label={field.label}
        helperText={helperText}
        disabled={readOnly}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      />
    );
  }

  if (field.type_name === 'datetime') {
    return (
      <TextField
        size="small"
        fullWidth
        type="datetime-local"
        label={field.label}
        helperText={helperText}
        disabled={readOnly}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
    );
  }

  return (
    <TextField
      size="small"
      fullWidth
      multiline={field.type_name === 'paragraph'}
      rows={field.type_name === 'paragraph' ? 3 : undefined}
      label={field.label}
      helperText={helperText}
      disabled={readOnly}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || null)}
    />
  );
};
