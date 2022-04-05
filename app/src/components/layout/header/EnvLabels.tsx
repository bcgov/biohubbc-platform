import { Theme } from '@material-ui/core/styles/createMuiTheme';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { ConfigContext } from 'contexts/configContext';
import React, { useContext } from 'react';

const useStyles = makeStyles((theme: Theme) => ({
  appPhaseTag: {
    marginLeft: theme.spacing(0.5),
    color: '#fcba19',
    textTransform: 'uppercase',
    fontSize: '0.875rem',
    fontWeight: 700
  }
}));

export const BetaLabel: React.FC = () => {
  const classes = useStyles();

  return (
    <sup className={classes.appPhaseTag} aria-label="This application is currently in beta phase of development">
      Beta
    </sup>
  );
};

export const EnvironmentLabel = () => {
  const classes = useStyles();

  const config = useContext(ConfigContext);

  if (config?.REACT_APP_NODE_ENV === 'prod') {
    return <></>;
  }

  return (
    <sup
      className={classes.appPhaseTag}
      aria-label={`This application is currently being run in the ${config?.REACT_APP_NODE_ENV} environment`}>
      & {config?.REACT_APP_NODE_ENV}
    </sup>
  );
};
