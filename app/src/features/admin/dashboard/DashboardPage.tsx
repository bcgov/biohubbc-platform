import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
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
        <Container maxWidth="xl">
          <Typography variant="h2" component="h1">Dashboard</Typography>
        </Container>
      </Paper>

      <Container maxWidth="xl"
        sx={{
          p: 2
        }}>
        <DatasetsForReviewTable />
      </Container>
    </>
  );
};

export default DashboardPage;
