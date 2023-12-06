import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Icon from '@mdi/react';
import { mdiPlus } from '@mdi/js';


/**
 * Page to display user management data/functionality.
 *
 * @return {*}
 */
const ManageSecurityRulesPage = () => {
  return (
    <Paper elevation={0}>
      <Container maxWidth="xl"
        sx={{
          display: 'flex',
          alignItemx: 'center',
          justifyContent: 'space-between',
          py: 5
        }}
      >
        <Typography variant="h1">Security Rules</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={
            <Icon path={mdiPlus} size={0.75}></Icon>
          }
        >
          Add Security Rule
        </Button>
      </Container>
    </Paper>
  );
};

export default ManageSecurityRulesPage;