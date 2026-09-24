import { Paper } from '@mui/material';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { GridRowParams } from '@mui/x-data-grid';
import { PageHeader } from 'components/header/PageHeader';
import SecuritiesDialog from 'components/security/SecuritiesDialog';
import { useSubmissionContext } from 'hooks/useContext';
import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import SubmissionHeaderSecurityStatus from './components/SubmissionHeaderSecurityStatus';
import { SubmissionHeaderToolbar } from './components/SubmissionHeaderToolbar';
import { SecurityReviewFeatures } from './features/SecurityReviewFeatures';
import { FeatureRow } from './features/table/SecurityReviewFeaturesTable.interface';
import { SubmissionUploadStatus } from './page/status/SubmissionUploadStatus';

/**
 * Page for admins to complete security reviews
 *
 * @returns
 */
export const AdminSubmissionPage = () => {
  const {
    submissionId,
    submissionDataLoader,
    featureDataLoader,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    featuresPagination
  } = useSubmissionContext();

  const submission = submissionDataLoader.data;

  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<number>>(new Set());
  const [dialogFeatureIds, setDialogFeatureIds] = useState<Set<number>>(new Set());
  const [isSecurityDialogOpen, setIsSecurityDialogOpen] = useState(false);

  const rows: FeatureRow[] = useMemo(() => {
    return (
      featureDataLoader.data?.features.map((feature) => ({
        id: feature.submission_feature_id,
        submission_feature_id: feature.submission_feature_id,
        feature_type_name: feature.feature_type_name,
        secured: feature.secured
      })) ?? []
    );
  }, [featureDataLoader.data]);

  const rowCount = featureDataLoader.data?.pagination.total ?? 0;

  /* ---------------- Handlers ---------------- */

  const handleToggleRowSelection = useCallback((params: GridRowParams<FeatureRow>) => {
    const id = params.id as number;

    setSelectedFeatureIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleOpenSecurityDialog = useCallback((featureIds: Set<number>) => {
    setDialogFeatureIds(featureIds);
    setIsSecurityDialogOpen(true);
  }, []);

  const handleOpenSingleRowSecurity = useCallback(
    (row: FeatureRow) => {
      handleOpenSecurityDialog(new Set([row.submission_feature_id]));
    },
    [handleOpenSecurityDialog]
  );

  const handleOpenBulkSecurity = useCallback(() => {
    handleOpenSecurityDialog(new Set(selectedFeatureIds));
  }, [handleOpenSecurityDialog, selectedFeatureIds]);

  const handleCloseSecurityDialog = useCallback(() => {
    setIsSecurityDialogOpen(false);
  }, []);

  const handleRefreshFeatures = useCallback(() => {
    featureDataLoader.refresh(submissionId, featuresPagination);
    submissionDataLoader.refresh(submissionId);
  }, [featureDataLoader, submissionDataLoader, submissionId, featuresPagination]);

  const handleSecurityChange = useCallback(() => {
    handleRefreshFeatures();
    handleCloseSecurityDialog();
  }, [handleRefreshFeatures, handleCloseSecurityDialog]);

  if (!submission) {
    return null;
  }

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs aria-label="submission breadcrumb">
            <Link component={RouterLink} to="/admin/submissions" underline="hover" color="inherit">
              Submissions
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              {submission.name}
            </Typography>
          </Breadcrumbs>
        }
        label={submission.name}
        subheader={
          <Stack direction="row" alignItems="center" gap={0.25} mt={1} mb={0.25}>
            <SubmissionHeaderSecurityStatus submission={submission} />
          </Stack>
        }
        buttons={
          <SubmissionHeaderToolbar
            submission={submission}
            onSecurityClick={handleOpenBulkSecurity}
            onSubmissionStageChange={handleRefreshFeatures}
          />
        }
      />

      <Container maxWidth="xl">
        <Paper sx={{ my: 3 }}>
          <SubmissionUploadStatus submissionId={submission.submission_id} />
        </Paper>

        <Paper sx={{ my: 3 }}>
          <SecurityReviewFeatures
            rows={rows}
            rowCount={rowCount}
            setSelectedFeatureIds={setSelectedFeatureIds}
            paginationModel={paginationModel}
            setPaginationModel={setPaginationModel}
            sortModel={sortModel}
            setSortModel={setSortModel}
            onRowClick={handleToggleRowSelection}
            onRowSecurityClick={handleOpenSingleRowSecurity}
          />
        </Paper>
      </Container>

      {isSecurityDialogOpen && (
        <SecuritiesDialog
          open={isSecurityDialogOpen}
          submissionFeatureIds={{ ids: dialogFeatureIds }}
          onClose={handleCloseSecurityDialog}
          onSubmit={handleSecurityChange}
        />
      )}
    </>
  );
};
