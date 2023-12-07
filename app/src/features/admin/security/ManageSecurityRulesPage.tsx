import * as React from 'react';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Icon from '@mdi/react';
import { mdiPlus } from '@mdi/js';
import Divider from '@mui/material/Divider';
import Toolbar from '@mui/material/Toolbar';
import SecurityRulesTable from './components/SecurityRulesTable';
import SecurityRuleForm from './components/SecurityRuleForm';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LoadingButton from '@mui/lab/LoadingButton';
import Stack from '@mui/material/Stack';
import grey from '@mui/material/colors/grey';

const isLoading = false;

const ManageSecurityRulesPage = () => {
  const [open, setOpen] = React.useState(false);

  const openSecurityRuleDialog = () => {
    setOpen(true);
  };

  const closeSecurityRuleDialog = () => {
    setOpen(false);
  };


  return (
    <>
      <Paper elevation={0}>
        <Container maxWidth="xl"
          sx={{
            display: 'flex',
            alignItemx: 'center',
            justifyContent: 'space-between',
            py: 4
          }}
        >
          <Typography variant="h1">Security Rules</Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={
              <Icon path={mdiPlus} size={0.75}></Icon>
            }
            onClick={openSecurityRuleDialog}
          >
            Create Security Rule
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
            <Typography component="h2" variant="h4">
              {isLoading ? <Skeleton width={200} /> : 'Records Found (3)'}
            </Typography>
          </Toolbar>
          <Divider></Divider>
          <Box mx={3}>
            {isLoading ? (
              <Box
                sx={{
                  '& .MuiSkeleton-root': {
                    transform: 'none'
                  },
                }}
              >
                <Stack
                  flexDirection="row"
                  alignItems="center"
                  height={56}
                  sx={{
                    borderBottom: '1px solid' + grey[300]
                  }}
                >
                  <Box width={50} px={2}>
                    <Skeleton animation="pulse" height={18} width={18} sx={{ flex: '0 0 auto', transform: 'none' }}></Skeleton>
                  </Box>
                  <Box flex="1 1 auto" px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                  <Box width={250} px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                  <Box width={200} px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                  <Box width={200} px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                  <Box width={80} px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                </Stack>
                <Stack
                  flexDirection="row"
                  alignItems="center"
                  height={52}
                  sx={{
                    borderBottom: '1px solid' + grey[300]
                  }}
                >
                  <Box width={50} px={2}>
                    <Skeleton animation="pulse" height={18} width={18} sx={{ flex: '0 0 auto', transform: 'none' }}></Skeleton>
                  </Box>
                  <Box flex="1 1 auto" px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                  <Box width={250} px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                  <Box width={200} px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                  <Box width={200} px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                  <Box width={80} px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                </Stack>
                <Stack
                  flexDirection="row"
                  alignItems="center"
                  height={52}
                >
                  <Box width={50} px={2}>
                    <Skeleton animation="pulse" height={18} width={18} sx={{ flex: '0 0 auto', transform: 'none' }}></Skeleton>
                  </Box>
                  <Box flex="1 1 auto" px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                  <Box width={250} px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                  <Box width={200} px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                  <Box width={200} px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                  <Box width={80} px={1.25}>
                    <Skeleton animation="pulse" height={18}></Skeleton>
                  </Box>
                </Stack>
              </Box>
            ) : (
              <SecurityRulesTable />
            )}
          </Box>

        </Paper>
      </Container>

      <Dialog
        fullWidth
        maxWidth="md"        
        open={open}
      >
        <DialogTitle>Create Security Rule</DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>Specify a category, name and description for this security rule.</Typography>
          <SecurityRuleForm></SecurityRuleForm>
        </DialogContent>
        <DialogActions>
          <LoadingButton variant="contained" color="primary" onClick={closeSecurityRuleDialog}>Save</LoadingButton>
          <Button variant="outlined" color="primary" onClick={closeSecurityRuleDialog}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ManageSecurityRulesPage;