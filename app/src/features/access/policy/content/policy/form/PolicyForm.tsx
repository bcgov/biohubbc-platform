import MonacoEditor from '@monaco-editor/react';
import { Box } from '@mui/material';
import CustomTextField from 'components/fields/CustomTextField';
import { useFormikContext } from 'formik';
import { IPolicyFormValues } from '../create/dialog/PolicyCreateDialog';

export const PolicyForm = () => {
  const { values, setFieldValue } = useFormikContext<IPolicyFormValues>();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Policy Name */}
      <CustomTextField label="Policy Name" name="name" />

      {/* Policy Description */}
      <CustomTextField label="Policy Description" name="description" />

      {/* Policy JSON */}
      <Box
        sx={{
          height: 400, // container height
          overflow: 'auto', // allow scrolling if content exceeds height
          border: '1px solid #ccc',
          borderRadius: 1,
        }}
      >
        <MonacoEditor
          height="100%" // fill the container
          language="json"
          value={values.json}
          onChange={(value) => setFieldValue('json', value || '')}
          options={{
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
          }}
        />
      </Box>
    </Box>
  );
};
