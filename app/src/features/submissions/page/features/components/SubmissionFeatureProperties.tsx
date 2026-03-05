import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

const formatPropertyValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

interface SubmissionFeaturePropertiesProps {
  data: Record<string, any>;
}

export const SubmissionFeatureProperties = ({ data }: SubmissionFeaturePropertiesProps) => {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <Box p={3}>
        <Typography variant="h2" component="h2" mb={2}>
          Properties
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableBody>
              {Object.entries(data)
                .filter(([key]) => key !== 'geometry')
                .map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ fontWeight: 700, textTransform: 'capitalize', width: '30%' }}>
                      {key.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell>{formatPropertyValue(value)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Paper>
  );
};
