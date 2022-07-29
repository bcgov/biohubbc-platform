import { Container, makeStyles, Theme, Typography } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import SearchComponent from 'features/search/SearchComponent';
import { Formik, FormikProps } from 'formik';
import { IAdvancedSearch } from 'interfaces/useSearchApi.interface';
import React, { useRef } from 'react';
import { useHistory } from 'react-router';

const useStyles = makeStyles((theme: Theme) => ({
  heroSearch: {
    background: 'rgb(247, 248, 250)',
    borderBottom: '1px solid rgb(140, 140, 140)',
    textAlign: 'center'
  }
}))

const HomePage = () => {
  const classes = useStyles()
  const formikRef = useRef<FormikProps<IAdvancedSearch>>(null);
  const history = useHistory()
  
  
  const handleSubmit = () => {
    const query = formikRef.current?.values?.keywords || ''

    if (!query) {
      return
    }

    history.push(`/search?keywords=${query}`)
  }

  return (
    <Box className={classes.heroSearch} p={10}>
      <Container maxWidth="md">
        <Box mb={10}>
          <Typography variant="h1">British Columbia's open-access source for terrestrial, aquatic species and habitat inventory data</Typography>
        </Box>
        <Box mx={10}>
          <Formik
            innerRef={formikRef}
            initialValues={{ keywords:'' }}
            onSubmit={handleSubmit}
          >
            <SearchComponent />
          </Formik>
        </Box>
      </Container>
    </Box>
  );
};

export default HomePage;
