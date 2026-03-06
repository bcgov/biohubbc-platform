import Box from '@mui/material/Box';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';

const DataRequestForm = () => {
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

export default DataRequestForm;
