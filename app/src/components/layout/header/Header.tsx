import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import OtherLink from '@material-ui/core/Link';
import { Theme } from '@material-ui/core/styles/createMuiTheme';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import { mdiHelpCircle } from '@mdi/js';
import Icon from '@mdi/react';
import headerImageLarge from 'assets/images/gov-bc-logo-horiz.png';
import headerImageSmall from 'assets/images/gov-bc-logo-vert.png';
import { BetaLabel, EnvironmentLabel } from 'components/layout/header/EnvLabels';
import { AuthGuard, SystemRoleGuard, UnAuthGuard } from 'components/security/Guards';
import { SYSTEM_ROLE } from 'constants/roles';
import React from 'react';
import { Link } from 'react-router-dom';
import { LoggedInUserControls, NotLoggedInUserControls } from './UserControls';

const useStyles = makeStyles((theme: Theme) => ({
  govHeader: {
    borderBottom: '2px solid #fcba19'
  },
  govHeaderToolbar: {
    height: '70px'
  },
  brand: {
    display: 'flex',
    flex: '0 0 auto',
    alignItems: 'center',
    color: 'inherit',
    textDecoration: 'none',
    fontSize: '1.25rem',
    fontWeight: 700,
    '& img': {
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
  userProfile: {
    color: theme.palette.primary.contrastText,
    fontSize: '0.9375rem',
    '& hr': {
      backgroundColor: '#4b5e7e',
      height: '1rem'
    },
    '& a': {
      color: 'inherit',
      textDecoration: 'none'
    },
    '& a:hover': {
      textDecoration: 'underline'
    }
  },
  govHeaderIconButton: {
    color: '#ffffff'
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

const Header: React.FC = () => {
  const classes = useStyles();

  const [openSupportDialog, setOpenSupportDialog] = React.useState(false);
  const preventDefault = (event: React.SyntheticEvent) => event.preventDefault();

  const showSupportDialog = () => {
    setOpenSupportDialog(true);
  };

  const hideSupportDialog = () => {
    setOpenSupportDialog(false);
  };

  return (
    <>
      <AppBar position="sticky" style={{ boxShadow: 'none' }}>
        <Box className={classes.govHeader}>
          <Toolbar className={classes.govHeaderToolbar}>
            <Container maxWidth="xl">
              <Box display="flex" justifyContent="space-between" width="100%">
                <Link to="/" className={classes.brand} aria-label="Go to Home Page">
                  <picture>
                    <source srcSet={headerImageLarge} media="(min-width: 1200px)"></source>
                    <source srcSet={headerImageSmall} media="(min-width: 600px)"></source>
                    <img src={headerImageSmall} alt={'Government of British Columbia'} />
                  </picture>
                  <span>
                    BioHub Data Aggregator System
                    <BetaLabel />
                    <EnvironmentLabel />
                  </span>
                </Link>
                <Box display="flex" className={classes.userProfile} my="auto" alignItems="center">
                  <UnAuthGuard>
                    <NotLoggedInUserControls />
                  </UnAuthGuard>
                  <AuthGuard>
                    <LoggedInUserControls />
                  </AuthGuard>
                  <Box pl={2}>
                    <Divider orientation="vertical" />
                  </Box>
                  <IconButton className={classes.govHeaderIconButton} onClick={showSupportDialog}>
                    <Icon path={mdiHelpCircle} size={1.12} />
                  </IconButton>
                </Box>
              </Box>
            </Container>
          </Toolbar>
        </Box>
        <Box className={classes.mainNav}>
          <Container maxWidth="xl">
            <Toolbar
              variant="dense"
              className={classes.mainNavToolbar}
              role="navigation"
              aria-label="Main Navigation"
              disableGutters>
              <Link to="/" id="menu_home">
                Home
              </Link>
              <Link to="/search" id="menu_search">
                Search
              </Link>
              <Link to="/submissions" id="menu_submissions">
                Submissions
              </Link>
              <SystemRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
                <Link to="/admin/users" id="menu_admin_users">
                  Manage Users
                </Link>
              </SystemRoleGuard>
            </Toolbar>
          </Container>
        </Box>
      </AppBar>

      <Dialog open={openSupportDialog}>
        <DialogTitle>Need Help?</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            For technical support or questions about this application, please contact:&nbsp;
            <OtherLink
              href="mailto:biohub@gov.bc.ca?subject=BioHub - Secure Document Access Request"
              underline="always"
              onClick={preventDefault}>
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
