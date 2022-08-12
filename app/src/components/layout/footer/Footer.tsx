import { Theme } from '@mui/material';
import { makeStyles } from '@mui/styles';
import Toolbar from '@mui/material/Toolbar';
import React from 'react';

const useStyles = makeStyles((theme: Theme) => ({
  appFooter: {
    backgroundColor: theme.palette.bcgovblue.main
  },
  appFooterToolbar: {
    minHeight: '46px',
    '& ul': {
      margin: 0,
      padding: 0,
      listStyleType: 'none'
    },
    '& li': {
      display: 'inline-block'
    },
    '& li + li ': {
      marginLeft: theme.spacing(1.5),
      paddingLeft: theme.spacing(1.5),
      borderLeft: '1px solid #4b5e7e'
    },
    '& a': {
      display: 'block',
      color: '#ffffff',
      fontSize: '0.875rem',
      textDecoration: 'none'
    },
    '& a:hover': {
      textDecoration: 'underline'
    }
  }
}));

const Footer: React.FC<React.PropsWithChildren> = () => {
  const classes = useStyles();

  return (
    <footer className={classes.appFooter}>
      <Toolbar className={classes.appFooterToolbar} role="navigation" aria-label="Footer">
        <ul>
          <li>
            <a href="https://www.gov.bc.ca/gov/content/home/disclaimer">Disclaimer</a>
          </li>
          <li>
            <a href="https://www.gov.bc.ca/gov/content/home/privacy">Privacy</a>
          </li>
          <li>
            <a href="https://www.gov.bc.ca/gov/content/home/accessible-government">Accessibility</a>
          </li>
          <li>
            <a href="https://www.gov.bc.ca/gov/content/home/copyright">Copyright</a>
          </li>
        </ul>
      </Toolbar>
    </footer>
  );
};

export default Footer;
