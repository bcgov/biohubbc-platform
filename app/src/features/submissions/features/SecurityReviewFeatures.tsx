import { Box, Stack, Typography } from '@mui/material';
import { GridRowSelectionModel } from '@mui/x-data-grid';
import { useSubmissionContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import { SecurityReviewFeaturesTable } from './table/SecurityReviewFeaturesTable';

export const SecurityReviewFeatures = () => {
  const { submissionFeaturesDataLoader, paginationModel, setPaginationModel, sortModel, setSortModel } =
    useSubmissionContext();

  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set()
  });

  const rows = useMemo(() => {
    return (
      submissionFeaturesDataLoader.data?.features.map((feature) => ({
        id: feature.submission_feature_id,
        submission_feature_id: feature.submission_feature_id,
        feature_type_display_name: feature.feature_type_name,
        feature_type_name: feature.feature_type_name,
        secured: feature.secured
      })) ?? []
    );
  }, [submissionFeaturesDataLoader.data]);

  const rowCount = submissionFeaturesDataLoader.data?.pagination.total ?? 0;

  const handleSecurityChange = (row: (typeof rows)[number]) => {
    console.log('Security clicked for row:', row);
    // TODO: POST request to update security
  };

  return (
    <Stack gap={2} py={2}>
      <Box px={2}>
        <Typography variant="h4">
          Features{' '}
          <Typography component="span" color="textSecondary">
            ({rowCount})
          </Typography>
        </Typography>
      </Box>
      <SecurityReviewFeaturesTable
        rows={rows}
        rowCount={rowCount}
        selectionModel={selectionModel}
        onSelectionChange={setSelectionModel}
        paginationModel={paginationModel}
        setPaginationModel={setPaginationModel}
        sortModel={sortModel}
        setSortModel={setSortModel}
        handleSecurityChange={handleSecurityChange}
      />
    </Stack>
  );
};
