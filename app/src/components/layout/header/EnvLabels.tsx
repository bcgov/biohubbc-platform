import { Theme } from '@mui/material';
import { makeStyles } from '@mui/styles';

const useStyles = makeStyles((theme: Theme) => ({
  appPhaseTag: {
    marginLeft: theme.spacing(0.5),
    color: '#fcba19',
    textTransform: 'uppercase',
    fontSize: '0.875rem'
  }
}));

export const BetaLabel: React.FC<React.PropsWithChildren> = () => {
  const classes = useStyles();

  return (
    <sup className={classes.appPhaseTag} aria-label="This application is currently in beta phase of development">
      Beta
    </sup>
  );
};
