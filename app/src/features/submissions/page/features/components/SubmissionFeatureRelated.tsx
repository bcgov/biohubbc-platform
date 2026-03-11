import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { IRelatedSubmissionFeature } from 'interfaces/useFeaturesApi.interface';
import { Link as RouterLink } from 'react-router-dom';

interface SubmissionFeatureRelatedProps {
  submissionId: string | undefined;
  relatedFeatures: IRelatedSubmissionFeature[];
}

export const SubmissionFeatureRelated = ({ submissionId, relatedFeatures }: SubmissionFeatureRelatedProps) => {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <Box p={3}>
        <Typography variant="h2" component="h2" mb={2}>
          Related
        </Typography>
        {submissionId && relatedFeatures.length > 0 ? (
          <List disablePadding>
            {relatedFeatures.map((related) => (
              <ListItem key={related.submission_feature_id} disablePadding divider>
                <ListItemButton
                  component={RouterLink}
                  to={`/search/${submissionId}/feature/${related.submission_feature_id}`}>
                  <ListItemText
                    primary={related.data?.name || related.feature_type_display_name}
                    secondary={related.feature_type_display_name}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
            <Typography color="text.secondary">No related features</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};
