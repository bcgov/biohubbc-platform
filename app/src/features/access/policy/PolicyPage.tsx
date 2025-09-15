import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { PolicyPageContainer } from './content/PolicyPageContainer';
import { PolicyPageHeader } from './header/PolicyPageHeader';

export const PolicyPage = () => {
  return (
    <>
      <Paper variant="outlined" sx={{ py: 4, bgcolor: '#fff' }}>
        <Container maxWidth="xl">
          <PolicyPageHeader />
        </Container>
      </Paper>
      <Container maxWidth="xl" sx={{ my: 3 }}>
        <PolicyPageContainer />
      </Container>
    </>
  );
};
