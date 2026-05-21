import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { ReactNode } from 'react';
import { SubmissionFeatureTable } from './SubmissionFeatureTable';
import { SubmissionFeatureTableProps } from './SubmissionFeatureTable.interface';

interface SubmissionDetailContentProps extends SubmissionFeatureTableProps {
  isSubmissionLoading: boolean;
  submission?: SubmissionRecordWithSecurity;
  breadcrumbs: ReactNode;
  subheader: ReactNode;
  hasSecuredFeatures: boolean;
}

export const SubmissionDetailContent = ({
  isSubmissionLoading,
  submission,
  breadcrumbs,
  subheader,
  hasSecuredFeatures,
  rows,
  rowCount,
  searchTerm,
  onSearch,
  onRowClick,
  isLoading,
  paginationModel,
  onPaginationModelChange,
  sortModel,
  onSortModelChange
}: SubmissionDetailContentProps) => {
  return (
    <LoadingGuard
      isLoading={isSubmissionLoading}
      isLoadingFallback={<SkeletonPage />}
      hasNoData={!submission}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography color="text.secondary">No submission found</Typography>
        </Box>
      }>
      <PageHeader breadcrumbs={breadcrumbs} label={submission?.name ?? ''} subheader={subheader} />

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {hasSecuredFeatures && (
          <AlertBanner icon={<Icon path={mdiLock} size={0.9} />} sx={{ my: 3 }}>
            This submission contains secured features.
          </AlertBanner>
        )}

        <SubmissionFeatureTable
          rows={rows}
          rowCount={rowCount}
          isLoading={isLoading}
          searchTerm={searchTerm}
          onSearch={onSearch}
          onRowClick={onRowClick}
          paginationModel={paginationModel}
          onPaginationModelChange={onPaginationModelChange}
          sortModel={sortModel}
          onSortModelChange={onSortModelChange}
        />
      </Container>
    </LoadingGuard>
  );
};
