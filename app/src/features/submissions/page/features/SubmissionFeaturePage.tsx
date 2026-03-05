import { mdiCheck, mdiLock, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { useApi } from 'hooks/useApi';
import { useCartContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';

/**
 * Formats a property value for display.
 * Handles primitives, arrays, and objects.
 */
const formatPropertyValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

/**
 * Feature detail page displaying properties and related features.
 */
export const SubmissionFeaturePage = () => {
  const biohubApi = useApi();
  const { features: cartFeatures, addToCart, removeFromCart } = useCartContext();

  const { submissionId, submissionFeatureId } = useParams<{ submissionId: string; submissionFeatureId: string }>();

  const featureDataLoader = useDataLoader(() =>
    biohubApi.features.getSubmissionFeatureById(Number(submissionId), Number(submissionFeatureId))
  );

  useEffect(() => {
    featureDataLoader.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, submissionFeatureId]);

  const isInCart = useMemo(
    () => cartFeatures.some((f) => f.submission_feature_id === Number(submissionFeatureId)),
    [cartFeatures, submissionFeatureId]
  );


  if (!featureDataLoader.data) {
    return (
      <Container maxWidth="xl">
        <Box py={6} display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  const { feature, relatedFeatures } = featureDataLoader.data;

  const handleCartToggle = () => {
    if (isInCart) {
      removeFromCart([feature.submission_feature_id]);
    } else {
      addToCart([
        {
          submission_feature_id: feature.submission_feature_id,
          submission_id: feature.submission_id,
          uuid: feature.uuid,
          feature_type_id: feature.feature_type_id,
          feature_type_name: feature.feature_type_name,
          feature_name: null,
          feature_description: null,
          submission_name: feature.submission_name,
          is_secured: feature.secured,
          relevancy_score: 0
        }
      ]);
    }
  };

  return (
    <>
      <PageHeader
        buttons={
          <Button
            variant={isInCart ? 'outlined' : 'contained'}
            startIcon={<Icon path={isInCart ? mdiCheck : mdiPlus} size={0.875} />}
            onClick={handleCartToggle}>
            {isInCart ? 'In Cart' : 'Add to Cart'}
          </Button>
        }
        breadcrumbs={
          <Breadcrumbs aria-label="breadcrumb">
            <Link component={RouterLink} to="/search" underline="hover" color="inherit">
              Search
            </Link>
            <Typography color="text.secondary">{feature.submission_name}</Typography>
            <Typography color="text.primary">{feature.feature_type_display_name}</Typography>
          </Breadcrumbs>
        }
        label={
          <Box display="flex" alignItems="center" gap={1.5}>
            <Typography variant="h1" sx={{ ml: '-2px' }}>
              {feature.feature_type_display_name}
            </Typography>
          </Box>
        }
        subheader={
          <Box display="flex" gap={1}>
            <Chip label={feature.feature_type_name} size="small" />
            {feature.secured && (
              <Chip icon={<Icon path={mdiLock} size={0.625} />} label="Secured" size="small" />
            )}
          </Box>
        }
      />
      <Container maxWidth="xl">
        <Stack spacing={3} py={4}>
          {/* Properties Section */}
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Box p={3}>
              <Typography variant="h2" component="h2" mb={2}>
                Properties
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    {Object.entries(feature.data)
                      .filter(([key]) => key !== 'geometry')
                      .map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell
                            component="th"
                            scope="row"
                            sx={{ fontWeight: 700, textTransform: 'capitalize', width: '30%' }}>
                            {key.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell>{formatPropertyValue(value)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Paper>

          {/* Related Features Section */}
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Box p={3}>
              <Typography variant="h2" component="h2" mb={2}>
                Related
              </Typography>
              {relatedFeatures.length > 0 ? (
                <List disablePadding>
                  {relatedFeatures.map((related) => (
                    <ListItem key={related.submission_feature_id} disablePadding divider>
                      <ListItemButton
                        component={RouterLink}
                        to={`/search/${feature.submission_id}/feature/${related.submission_feature_id}`}>
                        <ListItemText
                          primary={related.data?.name || related.feature_type_display_name}
                          secondary={related.feature_type_display_name}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary">No related features</Typography>
              )}
            </Box>
          </Paper>
        </Stack>
      </Container>
    </>
  );
};
