import { mdiMapSearchOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import { grey } from '@mui/material/colors';
import Paper from '@mui/material/Paper';
import Skeleton, { SkeletonProps } from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

interface IMultipleSkeletonProps extends SkeletonProps {
  numberOfLines?: number;
}

type ISingleSkeletonProps = SkeletonProps;

/**
 * Render a vertical list of skeleton lines.
 *
 * @param {IMultipleSkeletonProps} props
 * @returns {JSX.Element}
 */
const SkeletonList = ({ numberOfLines, ...skeletonProps }: IMultipleSkeletonProps) => (
  <>
    {Array.from(new Array(numberOfLines ?? 3).keys()).map((key: number) => (
      <Stack
        key={key}
        flexDirection="row"
        alignItems="center"
        gap={2}
        sx={{
          px: 2,
          height: '56px',
          background: '#fff',
          borderBottom: '1px solid ' + grey[300],
          '& .MuiSkeleton-root:not(:first-of-type)': {
            flex: '1 1 auto'
          },
          '& *': {
            fontSize: '0.875rem'
          }
        }}>
        <Skeleton variant="text" width={20} height={20} {...skeletonProps} />
        <Skeleton variant="text" {...skeletonProps} />
      </Stack>
    ))}
  </>
);

/**
 * Render a horizontal row of rounded skeleton blocks.
 *
 * @param {IMultipleSkeletonProps} props
 * @returns {JSX.Element}
 */
const SkeletonHorizontalStack = ({ numberOfLines, ...skeletonProps }: IMultipleSkeletonProps) => (
  <Stack direction="row" spacing={1} flex="1 1 auto">
    {Array.from(new Array(numberOfLines ?? 3).keys()).map((key: number) => (
      <Skeleton key={key} variant="rounded" sx={{ flex: '0.1 0 auto' }} {...skeletonProps} />
    ))}
  </Stack>
);

/**
 * Render a table-style skeleton composed of repeated skeleton rows.
 *
 * @param {IMultipleSkeletonProps} props
 * @returns {JSX.Element}
 */
const SkeletonTable = ({ numberOfLines, ...skeletonProps }: IMultipleSkeletonProps) => (
  <Box>
    <Paper elevation={0}>
      {Array.from(new Array(numberOfLines ?? 3).keys()).map((key: number) => (
        <SkeletonRow key={key} {...skeletonProps} />
      ))}
    </Paper>
  </Box>
);

/**
 * Render a single table row skeleton.
 *
 * @param {ISingleSkeletonProps} skeletonProps
 * @returns {JSX.Element}
 */
const SkeletonRow = (skeletonProps: ISingleSkeletonProps) => (
  <Stack
    flexDirection="row"
    alignItems="center"
    gap={2}
    sx={{
      px: 2,
      height: '56px',
      overflow: 'hidden',
      borderBottom: '1px solid ' + grey[300],
      '& .MuiSkeleton-root:not(:first-of-type)': {
        flex: '1 1 auto'
      },
      '& *': {
        fontSize: '0.875rem'
      }
    }}>
    {Array.from(new Array(8).keys()).map((key: number) => (
      <Skeleton key={key} variant="text" {...skeletonProps} />
    ))}
  </Stack>
);

/**
 * Render a full-size map placeholder with a centered search icon.
 *
 * @param {ISingleSkeletonProps} skeletonProps
 * @returns {JSX.Element}
 */
const SkeletonMap = (skeletonProps: ISingleSkeletonProps) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      background: '#fff',
      '& svg': {
        color: grey[300]
      }
    }}>
    <Box sx={{ position: 'absolute', margin: 'auto' }}>
      <Icon path={mdiMapSearchOutline} size={2} />
    </Box>
    <Skeleton variant="rectangular" sx={{ width: '100%', height: '100%' }} {...skeletonProps} />
  </Box>
);

export { SkeletonHorizontalStack, SkeletonList, SkeletonMap, SkeletonTable };
