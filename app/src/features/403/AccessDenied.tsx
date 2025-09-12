import { mdiAlertCircleOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { Navigate, useNavigate } from 'react-router-dom';

const AccessDenied = () => {
  const authStateContext = useAuthStateContext();
  const navigate = useNavigate();

  if (!authStateContext.auth.isAuthenticated) {
    // User is not logged in, redirect to home
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxWidth="sm">
      <Box pt={6} textAlign="center">
        <Icon path={mdiAlertCircleOutline} size={2} color="#ff5252" />
        <Typography variant="h3" component="h1" gutterBottom>
          Access Denied
        </Typography>
        <Typography>You do not have permission to access this page.</Typography>
        <Box pt={4}>
          <Button
            onClick={() => navigate('/')}
            size="large"
            variant="contained"
            color="primary"
            data-testid="access-denied-return-home-button">
            Return Home
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default AccessDenied;
