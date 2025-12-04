import { Paper } from '@mui/material';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import BaseHeader from 'components/layout/header/BaseHeader';
import ManageSecurity from 'components/security/ManageSecurity';
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

export const AdminSubmissionPage = () => {
  const submissionContext = useSubmissionContext();
  const submission = submissionContext.submissionRecordDataLoader.data;

  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<number>>(new Set());
  const [manageSecurityOpen, setManageSecurityOpen] = useState(false);
  const [securityFeatureIds, setSecurityFeatureIds] = useState<Set<number>>(new Set());

  // Transform features into table rows
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

  // Row click toggles selection
  const handleRowClick = (params: any) => {
    const id = params.id as number;
    const newSet = new Set(selectedFeatureIds);

    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }

    setSelectedFeatureIds(newSet);
  };

  // Security icon click handler
  const handleSecurityChange = (row: FeatureRow) => {
    setSecurityFeatureIds(new Set([row.submission_feature_id]));
    setManageSecurityOpen(true);
  };

  // Close ManageSecurity modal
  const handleCloseManageSecurity = () => {
    setManageSecurityOpen(false);
    // Refresh features after security change
    submissionContext.submissionFeaturesDataLoader.refresh(
      submissionContext.submissionId,
      submissionContext.featuresPagination
    );
  };

  // Refresh for toolbar
  const handleRefresh = () => {
    submissionContext.submissionRecordDataLoader.refresh(submissionContext.submissionId);
    submissionContext.submissionFeaturesDataLoader.refresh(
      submissionContext.submissionId,
      submissionContext.featuresPagination
    );
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
            submissionFeatureIds={{ ids: selectedFeatureIds }}
            submission={submission}
            submissionId={submissionContext.submissionId}
            handleRefresh={handleRefresh}
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
            handleSecurityChange={handleSecurityChange}
          />
        </Paper>
      </Container>

      {manageSecurityOpen && (
        <ManageSecurity
          submissionFeatureIds={{ ids: securityFeatureIds }}
          onSubmit={handleRefresh}
          onClose={handleCloseManageSecurity}
        />
      )}
    </>
  );
};
