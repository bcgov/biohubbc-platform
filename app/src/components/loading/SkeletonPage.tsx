import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { Breakpoint } from '@mui/material/styles';
import { PageHeader } from 'components/header/PageHeader';
import { SkeletonTable } from './SkeletonLoaders';

interface SkeletonPageProps {
  numberOfLines?: number;
  /** Width of the header and body, matching the page being loaded. Defaults to `xl`. */
  maxWidth?: Breakpoint;
}

/**
 * Generic page-level skeleton with a header placeholder and table-like body rows.
 *
 * @param {SkeletonPageProps} props - Component props.
 * @returns {JSX.Element}
 */
export const SkeletonPage = ({ numberOfLines = 6, maxWidth = 'xl' }: SkeletonPageProps) => {
  return (
    <>
      <PageHeader
        maxWidth={maxWidth}
        breadcrumbs={<Skeleton variant="text" width={220} height={20} />}
        label={<Skeleton variant="text" width={320} height={44} />}
        subheader={
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={120} height={24} />
            <Skeleton variant="rounded" width={140} height={24} />
          </Stack>
        }
      />
      <Container maxWidth={maxWidth} sx={{ py: 4 }}>
        <SkeletonTable numberOfLines={numberOfLines} />
      </Container>
    </>
  );
};
