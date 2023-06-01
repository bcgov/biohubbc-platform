import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import DatasetsForReviewTable from './components/DatasetsForReviewTable';

const DashboardPage = () => {
  return (
    <Box>
      <Paper
        square
        elevation={0}
        sx={{
          py: 7
        }}>
        <Container maxWidth="xl">
          <Typography
            variant="h1"
            sx={{
              mt: -2,
              mb: 4
            }}>
            Dashboard
          </Typography>
          <Typography
            variant="h3"
            sx={{
              mt: 6,
              mb: 4
            }}>
            Pending Security Reviews
          </Typography>
          <Divider />
        </Container>
      </Paper>
      <Container maxWidth="xl">
        <Box>
          <DatasetsForReviewTable />
        </Box>
      </Container>
    </Box>
  );
};

export default DashboardPage;
