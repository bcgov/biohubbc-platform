import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { IRelatedSubmissionFeature } from 'interfaces/useFeaturesApi.interface';
import { Link as RouterLink, useLocation } from 'react-router-dom';

interface SubmissionFeatureRelatedProps {
  submissionId: number;
  relatedFeatures: IRelatedSubmissionFeature[];
  featureRouteBasePath?: string;
}

export const SubmissionFeatureRelated = ({
  submissionId,
  relatedFeatures,
  featureRouteBasePath = '/submission'
}: SubmissionFeatureRelatedProps) => {
  const location = useLocation();

  return (
    <Box>
      {submissionId && relatedFeatures.length > 0 ? (
        <List disablePadding>
          {relatedFeatures.map((related) => (
            <ListItem key={related.submission_feature_id} disablePadding divider>
              <ListItemButton
                component={RouterLink}
                to={`${featureRouteBasePath}/${submissionId}/feature/${related.submission_feature_id}${location.search}`}>
                <ListItemText
                  primary={related.data?.name || related.feature_type_display_name}
                  secondary={related.feature_type_display_name}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      ) : (
        <Box display="flex" justifyContent="center" alignItems="center" p={5}>
          <Typography color="text.secondary" variant="body2">
            No related features
          </Typography>
        </Box>
      )}
    </Box>
  );
};
