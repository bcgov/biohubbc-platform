import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import DatasetsForReviewTable from './components/DatasetsForReviewTable';
import Stack from '@mui/material/Stack';

const DashboardPage = () => {
  return (
    <>
      <Paper
        square
        elevation={0}>
        <Container maxWidth="xl"
          sx={{
            py: 4
          }}
        >
          <Typography variant="h2" component="h1">
            Dashboard
          </Typography>
        </Container>
      </Paper>

      <Container
        maxWidth="xl"
        sx={{
          p: 3
        }}>
        <Stack mt={1} mb={4}>
          <Typography variant="h3" component="h2">Pending Review</Typography>
        </Stack>
        <DatasetsForReviewTable />
      </Container>
    </>
  );
};

export default DashboardPage;
