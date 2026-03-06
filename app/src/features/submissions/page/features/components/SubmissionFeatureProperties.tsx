import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { ReactNode } from 'react';

interface SubmissionFeaturePropertiesProps {
  data: Record<string, any>;
  isLoading?: boolean;
}

export const SubmissionFeatureProperties = ({ data, isLoading }: SubmissionFeaturePropertiesProps) => {
  const formatPropertyValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const formatPropertyName = (name: string): string => {
    return name.replace(/_/g, ' ')
  }

  const renderPropertyRows = (): ReactNode => {
    return (
      Object.entries(data)
        .filter(([key]) => key !== 'geometry')
        .map(([key, value]) => (
          <TableRow key={key}>
            <TableCell
              component="th"
              scope="row"
              sx={{ fontWeight: 700, textTransform: 'capitalize', width: '30%' }}>
              {formatPropertyName(key)}
            </TableCell>
            <TableCell>{formatPropertyValue(value)}</TableCell>
          </TableRow>
        ))
    )
  }

  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <Box p={3}>
        <Typography variant="h2" component="h2" mb={2}>
          Properties
        </Typography>
        <LoadingGuard isLoading={isLoading} isLoadingFallback={<SkeletonList numberOfLines={3} />}>
          <TableContainer>
            <Table size="small">
              <TableBody>
                {renderPropertyRows()}
              </TableBody>
            </Table>
          </TableContainer>
        </LoadingGuard>
      </Box>
    </Paper>
  );
};
