import { mdiClose, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { FieldArray, useFormikContext } from 'formik';
import { IAddPolicyFormValues, IStatementFormValues } from 'interfaces/usePoliciesApi.interface';
import { v4 as uuidv4 } from 'uuid';

const getDefaultStatement = (): IStatementFormValues => ({
  _key: uuidv4(),
  effect: 'allow',
  submission_feature_urn: 'urn:*:*:*'
});

const PolicyStatementsEditor: React.FC = () => {
  const { values, setFieldValue } = useFormikContext<IAddPolicyFormValues>();

  return (
    <Box>
      <Typography variant="h6" mb={2}>
        Policy Statements
      </Typography>

      <FieldArray name="statements">
        {({ push, remove }) => (
          <>
            {values.statements.map((statement, index) => (
              <Card key={statement._key} sx={{ mb: 2, position: 'relative' }}>
                <IconButton size="small" onClick={() => remove(index)} sx={{ position: 'absolute', top: 8, right: 8 }}>
                  <Icon path={mdiClose} size={0.8} />
                </IconButton>

                <CardContent>
                  <Typography variant="subtitle2" mb={2}>
                    Statement {index + 1}
                  </Typography>

                  <Box display="flex" flexDirection="column" gap={2}>
                    <FormControl size="small" sx={{ width: 150 }}>
                      <InputLabel>Effect</InputLabel>
                      <Select
                        value={statement.effect}
                        label="Effect"
                        onChange={(e) => setFieldValue(`statements.${index}.effect`, e.target.value)}>
                        <MenuItem value="allow">Allow</MenuItem>
                        <MenuItem value="deny">Deny</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      size="small"
                      label="Submission Feature URN"
                      value={statement.submission_feature_urn}
                      onChange={(e) => setFieldValue(`statements.${index}.submission_feature_urn`, e.target.value)}
                      placeholder="urn:*:*:*"
                      helperText="Format: urn:<submissionId>:<featureType>:<featureId>"
                      fullWidth
                    />
                  </Box>
                </CardContent>
              </Card>
            ))}

            <Button
              variant="outlined"
              startIcon={<Icon path={mdiPlus} size={1} />}
              onClick={() => push(getDefaultStatement())}>
              Add Statement
            </Button>
          </>
        )}
      </FieldArray>
    </Box>
  );
};

export default PolicyStatementsEditor;
