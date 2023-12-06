import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Icon from '@mdi/react';
import { mdiPlus } from '@mdi/js';
import Divider from '@mui/material/Divider';
import Toolbar from '@mui/material/Toolbar';
import ManageSecurityRulesTable from './ManageSecurityRulesTable';
import Box from '@mui/material/Box';

const ManageSecurityRulesPage = () => {
  return (
    <>
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
      <Container maxWidth="xl"
        sx={{
          py: 3
        }}
      >
        <Paper elevation={0}>
          <Toolbar>
            <Typography component="h2" variant="h4">Security Rules</Typography>
          </Toolbar>
          <Divider></Divider>
          <Box mx={3}>
            <ManageSecurityRulesTable/>
          </Box>
        </Paper>
      </Container>
    </>
  );
};

export default ManageSecurityRulesPage;