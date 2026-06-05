import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { PageHeader } from 'components/header/PageHeader';
import { SkeletonTable } from './SkeletonLoaders';

interface SkeletonPageProps {
  numberOfLines?: number;
}

/**
 * Generic page-level skeleton with a header placeholder and table-like body rows.
 *
 * @param {SkeletonPageProps} props - Component props.
 * @returns {JSX.Element}
 */
export const SkeletonPage = ({ numberOfLines = 6 }: SkeletonPageProps) => {
  return (
    <>
      <PageHeader
        breadcrumbs={<Skeleton variant="text" width={220} height={20} />}
        label={<Skeleton variant="text" width={320} height={44} />}
        subheader={
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={120} height={24} />
            <Skeleton variant="rounded" width={140} height={24} />
          </Stack>
        }
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <SkeletonTable numberOfLines={numberOfLines} />
      </Container>
    </>
  );
};
