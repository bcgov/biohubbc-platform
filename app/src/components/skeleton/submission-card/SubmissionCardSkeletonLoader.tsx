import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import grey from '@mui/material/colors/grey';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const SubmissionCardSkeletonLoader = () => {
  return (
    <Card elevation={0}>
      <CardHeader
        title={
          <Typography variant="h4">
            <Skeleton sx={{ maxWidth: 800, transform: 'scale(1, 0.8)' }}></Skeleton>
          </Typography>
        }
        action={<Skeleton width={70}></Skeleton>}
        sx={{
          pb: 1,
          '& .MuiCardHeader-action': {
            margin: 0
          }
        }}></CardHeader>
      <CardContent
        sx={{
          pt: 0
        }}>
        <Typography
          variant="body1"
          color="textSecondary"
          sx={{
            maxWidth: 800
          }}>
          <Skeleton sx={{ maxWidth: 400 }}></Skeleton>
        </Typography>
      </CardContent>
      <CardActions
        sx={{
          px: 2,
          py: 1.5,
          borderTop: '1px solid' + grey[200]
        }}>
        <Stack flexDirection="row" alignItems="center" justifyContent="space-between" width="100%">
          <Skeleton width={150}></Skeleton>
          <Skeleton
            variant="rectangular"
            height={36}
            width={100}
            sx={{
              borderRadius: '4px'
            }}></Skeleton>
        </Stack>
      </CardActions>
    </Card>
  );
};

export default SubmissionCardSkeletonLoader;
