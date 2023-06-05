import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import DatasetsForReviewTable from './components/DatasetsForReviewTable';

const DashboardPage = () => {
  return (
    <>
      <Paper
        square
        elevation={0}
        sx={{
          py: 4,
          px: 3
        }}>
        <Typography variant="h1">Dashboard</Typography>
      </Paper>
      <Paper
        square
        elevation={0}
        sx={{
          m: 3,
          borderRadius: 2
        }}>
        <Typography
          variant="h3"
          sx={{
            p: 3,
            borderBottom: '1pt solid #dadada',
            mb: 1
          }}>
          Pending Security Reviews
        </Typography>
        <Box
          sx={{
            p: 2
          }}>
          <DatasetsForReviewTable />
        </Box>
      </Paper>
    </>
  );
};

export default DashboardPage;
