import { Container, Paper, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import SearchComponent from 'features/search/SearchComponent';
import { Formik, FormikProps } from 'formik';
import { IAdvancedSearch } from 'interfaces/useSearchApi.interface';
import { useRef } from 'react';
import { useHistory } from 'react-router';

const HomePage = () => {
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
    <Paper square elevation={0}>
      <Container
        maxWidth="md"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '30rem'
        }}
      >
        <Typography
          variant="h1"
          sx={{
            mt: -4,
            fontSize: '3rem',
            letterSpacing: '-0.03rem'
          }}
        >
          Biodiversity Hub B.C.
        </Typography>
        <Typography
          variant="body1"
          color="textSecondary"
          sx={{
            mt: 3,
            mb: 6,
            maxWidth: '45ch',
            fontSize: '1.75rem',
            lineHeight: '1.25'
          }}
        >
          Open access to British Columbia's terrestrial, aquatic species and habitat inventory data
        </Typography>
        <Box>
          <Formik innerRef={formikRef} initialValues={{ keywords: '' }} onSubmit={handleSubmit}>
            <SearchComponent />
          </Formik>
        </Box>
      </Container>
    </Paper>
  );
};

export default HomePage;
