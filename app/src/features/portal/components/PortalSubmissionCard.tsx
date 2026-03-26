import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import { grey } from '@mui/material/colors';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import { SubmissionRecordWithSecurityAndRootFeature } from 'interfaces/useSubmissionsApi.interface';
import { Link as RouterLink } from 'react-router-dom';
import { getDaysSinceDate, pluralize as p } from 'utils/Utils';

const SECURITY_LABEL: Record<string, string> = {
  PENDING: 'Pending Review',
  SECURED: 'Secured',
  UNSECURED: 'Published'
};

export interface PortalSubmissionCardProps {
  submission: SubmissionRecordWithSecurityAndRootFeature;
}

export const PortalSubmissionCard = ({ submission }: PortalSubmissionCardProps) => {
  const sortedRegions = [...submission.regions].sort();

  return (
    <Card elevation={0}>
      <CardHeader
        sx={{
          pb: 1,
          '& .MuiCardHeader-action': {
            margin: 0
          }
        }}
        title={
          <Typography
            variant="h4"
            component="h3"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: '2',
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
            {submission.name}
          </Typography>
        }
        action={
          <Stack direction="row" gap={1}>
            <Chip
              label={submission.root_feature_type_name}
              size="small"
              sx={{
                my: '-2px',
                fontSize: '12px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}
            />
            <Chip
              label={SECURITY_LABEL[submission.security] ?? submission.security}
              size="small"
              sx={{
                my: '-2px',
                fontSize: '12px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}
            />
          </Stack>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <Typography
          color="textSecondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: '2',
            WebkitBoxOrient: 'vertical',
            maxWidth: 800,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
          {submission.description}
        </Typography>
      </CardContent>
      <CardActions
        sx={{
          px: 2,
          py: 1.5,
          borderTop: '1px solid' + grey[200]
        }}>
        <Stack
          width="100%"
          flexDirection={{ xs: 'column', sm: 'row' }}
          flexWrap="wrap"
          gap={1}
          justifyContent="space-between">
          <Stack
            flex="1 1 auto"
            flexDirection={{ xs: 'column', sm: 'row' }}
            gap={{ xs: 0, sm: 1 }}
            my={1}
            component="dl"
            divider={<Divider flexItem orientation="vertical" />}
            sx={{
              typography: 'body2',
              whiteSpace: 'nowrap',
              '& dd': {
                color: 'text.secondary'
              },
              '& dt': {
                ml: 1
              }
            }}>
            <Stack flexDirection="row">
              <dd>Submitted:</dd>
              <dt>{getDaysSinceDate(dayjs(submission.submitted_timestamp))}</dt>
            </Stack>
            {submission.regions.length > 0 && (
              <Stack flexDirection="row">
                <dd>{p(submission.regions.length, 'Region')}:</dd>
                <dt>{sortedRegions.join(', ')}</dt>
              </Stack>
            )}
          </Stack>
          <Stack flexDirection="row" alignItems="center" gap={1} flexWrap="nowrap">
            <Button
              component={RouterLink}
              variant="contained"
              to={`/`}
              sx={{
                flex: '0 0 auto',
                minWidth: '7rem'
              }}>
              View
            </Button>
          </Stack>
        </Stack>
      </CardActions>
    </Card>
  );
};
