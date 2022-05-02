import Box from '@material-ui/core/Box';
import makeStyles from '@material-ui/core/styles/makeStyles';
import React from 'react';

const useStyles = makeStyles(() => ({
  contentLayoutRoot: {
    width: 'inherit',
    height: '100%',
    display: 'flex',
    flex: '1',
    flexDirection: 'column'
  },
  contentContainer: {
    flex: '1',
    overflow: 'auto'
  }
}));

const ContentLayout: React.FC = (props) => {
  const classes = useStyles();

  return (
    <Box className={classes.contentLayoutRoot}>
      <Box className={classes.contentContainer}>{props.children}</Box>
    </Box>
  );
};

export default ContentLayout;
