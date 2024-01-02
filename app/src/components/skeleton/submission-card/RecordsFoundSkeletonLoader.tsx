import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

const RecordsFoundSkeletonLoader = () => {
  return (
    <Box pb={4} data-testid="records-found-skeleton">
      <Typography variant="h4" component="h2">
        <Skeleton height={22} width={150}></Skeleton>
      </Typography>
    </Box>
  );
};

export default RecordsFoundSkeletonLoader;
