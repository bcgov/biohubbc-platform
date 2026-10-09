import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { SubmissionUploadScope } from 'interfaces/useAdminApi.interface';
import { useMemo } from 'react';
import { adminSubmissionUploadQueryKeys } from '../../submission-upload-query-keys';

interface SubmissionUploadMetadataRow {
  id: string;
  property: string;
  value: string | number | null;
}

interface AdminSubmissionUploadMetadataProps {
  scope: SubmissionUploadScope;
}

/**
 * Display upload identity and the blueprint the upload was created with in the standard metadata grid. An upload's
 * blueprint never changes; the default for future uploads is edited on the submission.
 *
 * @param {AdminSubmissionUploadMetadataProps} props Submission and upload whose metadata is displayed.
 * @returns {JSX.Element} Metadata page section.
 */
export const AdminSubmissionUploadMetadata = ({ scope }: AdminSubmissionUploadMetadataProps) => {
  const api = useApi();
  const blueprintQuery = useQuery({
    queryKey: adminSubmissionUploadQueryKeys.blueprint(scope),
    queryFn: ({ signal }) => api.admin.getSubmissionUploadBlueprint(scope, { signal })
  });
  const blueprint = blueprintQuery.data;
  const columns = useMemo<GridColDef<SubmissionUploadMetadataRow>[]>(
    () => [
      { field: 'property', headerName: 'Property', flex: 0.3 },
      {
        field: 'value',
        headerName: 'Value',
        flex: 0.7,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={String(params.value ?? '')} sx={{ width: '100%' }}>
            {params.value}
          </Typography>
        )
      }
    ],
    []
  );

  const rows: SubmissionUploadMetadataRow[] = [
    { id: 'submission_id', property: 'submission_id', value: scope.submissionId },
    { id: 'submission_upload_id', property: 'submission_upload_id', value: scope.submissionUploadId },
    {
      id: 'blueprint',
      property: 'blueprint',
      value: blueprint ? `${blueprint.name} (Version ${blueprint.version_number})` : null
    }
  ];

  return (
    <PageSection id="submission-upload-metadata" label="Metadata">
      <CustomDataGrid
        autoHeight
        rows={rows}
        columns={columns}
        loading={blueprintQuery.isPending}
        disableColumnSelector
        hideFooter
        rowSelection={false}
      />
    </PageSection>
  );
};
