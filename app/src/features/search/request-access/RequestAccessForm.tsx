import Box from '@mui/material/Box';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import yup from 'utils/YupSchema';

export interface IRequestAccessFormValues {
  reason: string;
}

export const requestAccessFormInitialValues: IRequestAccessFormValues = {
  reason: ''
};

export const requestAccessFormYupSchema = yup.object().shape({
  reason: yup.string().min(1, 'A reason is required').max(2000, 'Cannot exceed 2000 characters').required('A reason is required')
});

const RequestAccessForm = () => {
  return (
    <Box display="flex">
      <CustomTextFieldFormik
        name="reason"
        label="Reason for access"
        multiline
        rows={4}
        required
        slotProps={{ htmlInput: { maxLength: 2000 } }}
        sx={{ display: 'flex', width: '100%', mb: 2 }}
      />
    </Box>
  );
};

export default RequestAccessForm;
