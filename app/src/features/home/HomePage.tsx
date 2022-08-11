import { Container, makeStyles, Paper, Typography } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import SearchComponent from 'features/search/SearchComponent';
import { Formik, FormikProps } from 'formik';
import { IAdvancedSearch } from 'interfaces/useSearchApi.interface';
import React, { useRef } from 'react';
import { useHistory } from 'react-router';

const useStyles = makeStyles(() => ({
  heroBannerContainer: {
    textAlign: 'center',
    height: '26rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  }
}));

const HomePage = () => {
  const classes = useStyles();
  const formikRef = useRef<FormikProps<IAdvancedSearch>>(null);
  const history = useHistory();

  const handleSubmit = () => {
    const query = formikRef.current?.values?.keywords || '';

    if (!query) {
      return;
    }

    history.push(`/search?keywords=${query}`);
  };

  return (
    <Paper square elevation={2}>
      <Container maxWidth="md" className={classes.heroBannerContainer}>
        <Box display="flex" alignContent="center" mt={-2} mb={8}>
          <Typography variant="h1">
            British Columbia's open-access source for terrestrial, aquatic species and habitat inventory data
          </Typography>
        </Box>
        <Box mx={10}>
          <Formik innerRef={formikRef} initialValues={{ keywords: '' }} onSubmit={handleSubmit}>
            <SearchComponent />
          </Formik>
        </Box>
      </Container>
    </Paper>
  );
};

export default HomePage;
