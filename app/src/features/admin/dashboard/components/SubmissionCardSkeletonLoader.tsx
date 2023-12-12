import { Box, Divider, Skeleton } from '@mui/material';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const SubmissionCardSkeletonLoader = () => {
  return (
    <>
    <Box pb={4}>
      <Typography variant="h4" component="h2">
        <Skeleton height={22} width={150}></Skeleton>
      </Typography>
    </Box>
    <Card elevation={0}>
      <Stack flex="1 1 auto" gap={1} p={2}>
        <Stack flexDirection="row" alignItems="flex-start" gap={2}>
          <Stack flex="1 1 auto" flexDirection="row" gap={1} justifyContent="space-between">
            <Typography
              component="h3"
              variant="h4"
              sx={{
                flex: '1 1 auto',
                maxWidth: 800
              }}>
              <Skeleton height={20} sx={{ transform: 'none' }}></Skeleton>
            </Typography>
            <Skeleton width={60}></Skeleton>
          </Stack>
        </Stack>
        <Typography
          variant="body1"
          sx={{
            mb: 0.5,
            maxWidth: 800
          }}>
          <Skeleton></Skeleton>
          <Skeleton width="50%"></Skeleton>
        </Typography>
        <Divider flexItem></Divider>

        <Stack flexDirection="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Stack flexDirection="row" gap={2}>
            <Skeleton width={100} />
            <Skeleton width={100} />
          </Stack>
          <Skeleton variant="rectangular" width={112} height={36} />
        </Stack>
      </Stack>
    </Card>
    </>
  );
};

export default SubmissionCardSkeletonLoader;
