import { Paper } from '@mui/material';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import { GridRowParams } from '@mui/x-data-grid';
import BaseHeader from 'components/layout/header/BaseHeader';
import SecuritiesDialog from 'components/security/SecuritiesDialog';
import { useSubmissionContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import SubmissionHeaderSecurityStatus from './components/SubmissionHeaderSecurityStatus';
import { SubmissionHeaderToolbar } from './components/SubmissionHeaderToolbar';
import { SecurityReviewFeatures } from './features/SecurityReviewFeatures';

interface FeatureRow {
  id: number;
  submission_feature_id: number;
  feature_type_display_name: string;
  feature_type_name: string;
  secured: boolean;
}

/**
 * Admin page for applying security rules to features in a submission
 *
 * @returns {*}
 */
export const AdminSubmissionPage = () => {
  const submissionContext = useSubmissionContext();
  const submission = submissionContext.submissionRecordDataLoader.data;

  // Multi-row selection in the table
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<number>>(new Set());

  // Security dialog target (can be single or multiple rows)
  const [dialogFeatureIds, setDialogFeatureIds] = useState<Set<number>>(new Set());
  const [manageSecurityOpen, setManageSecurityOpen] = useState(false);

  const rows: FeatureRow[] = useMemo(() => {
    return (
      submissionContext.submissionFeaturesDataLoader.data?.features.map((feature) => ({
        id: feature.submission_feature_id,
        submission_feature_id: feature.submission_feature_id,
        feature_type_display_name: feature.feature_type_name,
        feature_type_name: feature.feature_type_name,
        secured: feature.secured
      })) ?? []
    );
  }, [submissionContext.submissionFeaturesDataLoader.data]);

  const rowCount = submissionContext.submissionFeaturesDataLoader.data?.pagination.total ?? 0;

  // Handle multi-row selection
  const handleRowClick = (params: GridRowParams<FeatureRow>) => {
    const id = params.id as number;
    const newSet = new Set(selectedFeatureIds);

    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }

    setSelectedFeatureIds(newSet);
  };

  // Open security dialog for a single row
  const onRowSecurityClick = (row: FeatureRow) => {
    setDialogFeatureIds(new Set([row.submission_feature_id]));
    setManageSecurityOpen(true);
  };

  const handleCloseManageSecurity = () => {
    setManageSecurityOpen(false);
  };

  const handleRefresh = () => {
    submissionContext.submissionRecordDataLoader.refresh(submissionContext.submissionId);
    submissionContext.submissionFeaturesDataLoader.refresh(
      submissionContext.submissionId,
      submissionContext.featuresPagination
    );
  };

  const handleSecurityChange = () => {
    handleRefresh();
    setManageSecurityOpen(false);
  };

  if (!submission) {
    return <></>;
  }

  return (
    <>
      <BaseHeader
        title={submission.name}
        subTitle={
          <Stack flexDirection="row" alignItems="center" gap={0.25} mt={1} mb={0.25}>
            <SubmissionHeaderSecurityStatus submission={submission} />
          </Stack>
        }
        buttonJSX={
          <SubmissionHeaderToolbar
            submission={submission}
            onSecurityClick={() => {
              // Open dialog for all currently selected rows
              setDialogFeatureIds(new Set(selectedFeatureIds));
              setManageSecurityOpen(true);
            }}
            onSubmissionStageChange={handleRefresh}
          />
        }
      />

      <Container maxWidth="xl">
        <Paper sx={{ my: 3 }}>
          <SecurityReviewFeatures
            rows={rows}
            rowCount={rowCount}
            selectedFeatureIds={selectedFeatureIds}
            setSelectedFeatureIds={setSelectedFeatureIds}
            paginationModel={submissionContext.paginationModel}
            setPaginationModel={submissionContext.setPaginationModel}
            sortModel={submissionContext.sortModel}
            setSortModel={submissionContext.setSortModel}
            onRowClick={handleRowClick}
            onRowSecurityClick={onRowSecurityClick}
          />
        </Paper>
      </Container>

      {/* Centralized security dialog */}
      {manageSecurityOpen && (
        <SecuritiesDialog
          submissionFeatureIds={{ ids: dialogFeatureIds }}
          open={manageSecurityOpen}
          onClose={handleCloseManageSecurity}
          onSubmit={handleSecurityChange}
        />
      )}
    </>
  );
};
