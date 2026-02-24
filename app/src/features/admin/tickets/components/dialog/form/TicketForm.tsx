import Stack from '@mui/material/Stack';
import CustomAutocomplete, { ICustomAutocompleteOption } from 'components/fields/CustomAutocomplete';
import CustomTextField from 'components/fields/CustomTextField';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { useFormikContext } from 'formik';
import { TicketPriority } from 'interfaces/useTicketsApi.interface';
import get from 'lodash-es/get';

export interface ITicketFormValues {
  title: string;
  description: string;
  priority: TicketPriority;
}

export const TICKET_PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const TICKET_PRIORITY_OPTIONS: ICustomAutocompleteOption<TicketPriority>[] = TICKET_PRIORITIES.map((value) => ({
  value,
  label: value
}));

export const TicketForm = () => {
  const { touched, errors, values, submitCount, setFieldValue } = useFormikContext<ITicketFormValues>();
  const selectedPriority = TICKET_PRIORITY_OPTIONS.find((option) => option.value === values.priority) ?? null;
  const showPriorityError = Boolean(get(errors, 'priority')) && (Boolean(get(touched, 'priority')) || submitCount > 0);

  return (
    <Stack gap={2} sx={{ pt: 1 }}>
      <CustomTextFieldFormik label="Title" name="title" required inputProps={{ maxLength: 100 }} />
      <CustomTextFieldFormik
        label="Description"
        name="description"
        multiline
        minRows={3}
        slotProps={{ htmlInput: { maxLength: 2000 } }}
      />
      <CustomAutocomplete
        id="priority"
        data-testid="priority"
        label="Priority"
        options={TICKET_PRIORITY_OPTIONS}
        value={selectedPriority}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        onChange={(_, option) => {
          if (option) {
            setFieldValue('priority', option.value);
          }
        }}
        renderInput={(params) => (
          <CustomTextField
            {...params}
            label="Priority"
            error={showPriorityError}
            helperText={showPriorityError ? String(get(errors, 'priority')) : undefined}
          />
        )}
      />
    </Stack>
  );
};
