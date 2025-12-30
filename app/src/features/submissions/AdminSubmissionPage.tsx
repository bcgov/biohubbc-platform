import { Paper } from '@mui/material';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import { GridRowParams } from '@mui/x-data-grid';
import BaseHeader from 'components/layout/header/BaseHeader';
import SecuritiesDialog from 'components/security/SecuritiesDialog';
import { useSubmissionContext } from 'hooks/useContext';
import { useCallback, useMemo, useState } from 'react';
import SubmissionHeaderSecurityStatus from './components/SubmissionHeaderSecurityStatus';
import { SubmissionHeaderToolbar } from './components/SubmissionHeaderToolbar';
import { SecurityReviewFeatures } from './features/SecurityReviewFeatures';
import { FeatureRow } from './features/table/SecurityReviewFeaturesTable.interface';

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
        feature_type_display_name: feature.feature_type_name,
        feature_type_name: feature.feature_type_name,
        secured: feature.secured
      })) ?? []
    );
  }, [featureDataLoader.data]);

  const rowCount = featureDataLoader.data?.pagination.total ?? 0;

  /* ---------------- Handlers ---------------- */

  const toggleRowSelection = useCallback((params: GridRowParams<FeatureRow>) => {
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

  const openSecurityDialog = useCallback((featureIds: Set<number>) => {
    setDialogFeatureIds(featureIds);
    setIsSecurityDialogOpen(true);
  }, []);

  const openSingleRowSecurity = useCallback(
    (row: FeatureRow) => {
      openSecurityDialog(new Set([row.submission_feature_id]));
    },
    [openSecurityDialog]
  );

  const openBulkSecurity = useCallback(() => {
    openSecurityDialog(new Set(selectedFeatureIds));
  }, [openSecurityDialog, selectedFeatureIds]);

  const closeSecurityDialog = useCallback(() => {
    setIsSecurityDialogOpen(false);
  }, []);

  const refreshFeatures = useCallback(() => {
    featureDataLoader.refresh(submissionId, featuresPagination);
    submissionDataLoader.refresh(submissionId);
  }, [featureDataLoader, submissionDataLoader, submissionId, featuresPagination]);

  const handleSecurityChange = useCallback(() => {
    refreshFeatures();
    closeSecurityDialog();
  }, [refreshFeatures, closeSecurityDialog]);

  if (!submission) {
    return null;
  }

  return (
    <>
      <BaseHeader
        title={submission.name}
        subTitle={
          <Stack direction="row" alignItems="center" gap={0.25} mt={1} mb={0.25}>
            <SubmissionHeaderSecurityStatus submission={submission} />
          </Stack>
        }
        buttonJSX={
          <SubmissionHeaderToolbar
            submission={submission}
            onSecurityClick={openBulkSecurity}
            onSubmissionStageChange={refreshFeatures}
          />
        }
      />

      <Container maxWidth="xl">
        <Paper sx={{ my: 3 }}>
          <SecurityReviewFeatures
            rows={rows}
            rowCount={rowCount}
            setSelectedFeatureIds={setSelectedFeatureIds}
            paginationModel={paginationModel}
            setPaginationModel={setPaginationModel}
            sortModel={sortModel}
            setSortModel={setSortModel}
            onRowClick={toggleRowSelection}
            onRowSecurityClick={openSingleRowSecurity}
          />
        </Paper>
      </Container>

      {isSecurityDialogOpen && (
        <SecuritiesDialog
          open={isSecurityDialogOpen}
          submissionFeatureIds={{ ids: dialogFeatureIds }}
          onClose={closeSecurityDialog}
          onSubmit={handleSecurityChange}
        />
      )}
    </>
  );
};
