import { mdiHelpCircle } from '@mdi/js';
import Icon from '@mdi/react';
import { Theme } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import OtherLink from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import headerImageLarge from 'assets/images/gov-bc-logo-horiz.png';
import headerImageSmall from 'assets/images/gov-bc-logo-vert.png';
import { BetaLabel } from 'components/layout/header/EnvLabels';
import { AuthGuard, SystemRoleGuard, UnAuthGuard } from 'components/security/Guards';
import { SYSTEM_ROLE } from 'constants/roles';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoggedInUserControls, NotLoggedInUserControls } from './UserControls';

const useStyles = makeStyles((theme: Theme) => ({
  govHeader: {},
  govHeaderToolbar: {
    height: '80px',
    backgroundColor: theme.palette.bcgovblue.main
  },
  brand: {
    display: 'flex',
    flex: '0 0 auto',
    alignItems: 'center',
    overflow: 'hidden',
    color: 'inherit',
    textDecoration: 'none',
    fontSize: '1.75rem',
    '& img': {
      marginTop: '-2px',
      verticalAlign: 'middle'
    },
    '& picture': {
      marginRight: '1.25rem'
    },
    '&:hover': {
      textDecoration: 'none'
    },
    '&:focus': {
      outlineOffset: '6px'
    }
  },
  '@media (max-width: 1000px)': {
    brand: {
      fontSize: '1rem',
      '& picture': {
        marginRight: '1rem'
      }
    },
    wrapText: {
      display: 'block'
    }
  },
  mainNav: {
    backgroundColor: '#38598a'
  },
  mainNavToolbar: {
    '& a': {
      display: 'block',
      padding: theme.spacing(2),
      color: 'inherit',
      fontSize: '1rem',
      textDecoration: 'none'
    },
    '& a:hover': {
      textDecoration: 'underline'
    },
    '& a:first-child': {
      marginLeft: theme.spacing(-2)
    }
  },
  '.MuiDialogContent-root': {
    '& p + p': {
      marginTop: theme.spacing(2)
    }
  }
}));

const Header: React.FC<React.PropsWithChildren> = () => {
  const classes = useStyles();

  const [openSupportDialog, setOpenSupportDialog] = useState(false);
  const preventDefault = (event: React.SyntheticEvent) => event.preventDefault();

  const showSupportDialog = () => {
    setOpenSupportDialog(true);
  };

  const hideSupportDialog = () => {
    setOpenSupportDialog(false);
  };

  return (
    <>
      <AppBar position="sticky" elevation={0}>
        <Box className={classes.govHeader}>
          <Toolbar className={classes.govHeaderToolbar}>
            <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
              <Box display="flex" alignItems="center">
                <Link to="/" className={classes.brand} aria-label="Go to Home Page">
                  <picture>
                    <source srcSet={headerImageLarge} media="(min-width: 1200px)"></source>
                    <source srcSet={headerImageSmall} media="(min-width: 600px)"></source>
                    <img src={headerImageSmall} alt={'Government of British Columbia'} />
                  </picture>
                  <span>
                    <strong>BioHub</strong>
                    <BetaLabel />
                    {/* <EnvironmentLabel /> */}
                  </span>
                </Link>
                <Box
                  ml={4}
                  sx={{
                    '& a': {
                      p: 2,
                      color: 'bcgovblue.contrastText',
                      fontWeight: 700,
                      textDecoration: 'none'
                    },
                    '& a:hover': {
                      textDecoration: 'underline'
                    }
                  }}
                >
                  <Link to="/" id="menu_home">
                    Home
                  </Link>
                  <Link to="/search" id="menu_search">
                    Find Datasets
                  </Link>
                  <Link to="/map" id="menu_map">
                    Map Search
                  </Link>
                  <SystemRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
                    <Link to="/admin/users" id="menu_admin_users">
                      Manage Users
                    </Link>
                  </SystemRoleGuard>
                </Box>
              </Box>
              <Box display="flex" alignItems="center">
                <IconButton
                  aria-label="Need help?"
                  onClick={showSupportDialog}
                  sx={{
                    color: 'bcgovblue.contrastText'
                  }}
                >
                  <Icon path={mdiHelpCircle} size={1} />
                </IconButton>
                <Box>
                  <UnAuthGuard>
                    <NotLoggedInUserControls />
                  </UnAuthGuard>
                  <AuthGuard>
                    <LoggedInUserControls />
                  </AuthGuard>
                </Box>
              </Box>
            </Box>
          </Toolbar>
        </Box>
        {/* <Box className={classes.mainNav}>
          <Toolbar variant="dense" className={classes.mainNavToolbar} role="navigation" aria-label="Main Navigation">
            <Link to="/" id="menu_home">
              Home
            </Link>
            <Link to="/search" id="menu_search">
              Find Datasets
            </Link>
            <Link to="/map" id="menu_map">
              Map Search
            </Link>
            <SystemRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
              <Link to="/admin/users" id="menu_admin_users">
                Manage Users
              </Link>
            </SystemRoleGuard>
          </Toolbar>
        </Box> */}
      </AppBar>

      <Dialog open={openSupportDialog}>
        <DialogTitle>Need Help?</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            For technical support or questions about this application, please contact:&nbsp;
            <OtherLink
              href="mailto:biohub@gov.bc.ca?subject=BioHub - Secure Document Access Request"
              underline="always"
              onClick={preventDefault}
            >
              biohub@gov.bc.ca
            </OtherLink>
            .
          </Typography>
          <Typography variant="body1">A support representative will respond to your request shortly.</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="primary" onClick={hideSupportDialog}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Header;
