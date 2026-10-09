import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { SYSTEM_ROLE } from 'constants/roles';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { useMemo, useState } from 'react';
import { hasAtLeastOneValidValue } from 'utils/authUtils';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { SubmissionDefaultBlueprintDialog } from '../dialog/SubmissionDefaultBlueprintDialog';

interface SubmissionMetadataRow {
  id: string;
  property: string;
  value: string | number | null;
  onEdit?: () => void;
}

/**
 * Display submission identity, contributor, creation fields and the default blueprint in the standard metadata grid.
 * System administrators can edit the default blueprint that the submission's future uploads use.
 *
 * @param props Submission whose metadata is displayed.
 * @returns {JSX.Element} Metadata page section and its default blueprint dialog.
 */
export const AdminSubmissionMetadata = ({ submission }: { submission: SubmissionRecordWithSecurity }) => {
  const api = useApi();
  const authStateContext = useAuthStateContext();
  const [blueprintDialogOpen, setBlueprintDialogOpen] = useState(false);
  const columns = useMemo<GridColDef<SubmissionMetadataRow>[]>(
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
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 100,
        align: 'right',
        headerAlign: 'right',
        sortable: false,
        renderCell: ({ row }) =>
          row.onEdit && (
            <Button variant="text" color="primary" aria-label={`Edit ${row.property}`} onClick={row.onEdit}>
              Edit
            </Button>
          )
      }
    ],
    []
  );
  const submissionId = submission.submission_id;
  const defaultBlueprintQuery = useQuery({
    queryKey: submissionQueryKeys.defaultBlueprint(submissionId),
    queryFn: ({ signal }) => api.admin.getSubmissionDefaultBlueprint(submissionId, { signal })
  });
  const defaultBlueprint = defaultBlueprintQuery.data ?? null;
  const canEditDefaultBlueprint =
    !defaultBlueprintQuery.isPending &&
    hasAtLeastOneValidValue([SYSTEM_ROLE.SYSTEM_ADMIN], authStateContext.biohubUserWrapper.roleNames);

  const rows: SubmissionMetadataRow[] = [
    { id: 'submission_id', property: 'submission_id', value: submission.submission_id },
    { id: 'uuid', property: 'uuid', value: submission.uuid },
    { id: 'contributor_name', property: 'contributor_name', value: submission.contributor_name },
    {
      id: 'default_blueprint',
      property: 'default_blueprint',
      value: defaultBlueprint ? `${defaultBlueprint.name} (Version ${defaultBlueprint.version_number})` : null,
      onEdit: canEditDefaultBlueprint ? () => setBlueprintDialogOpen(true) : undefined
    },
    { id: 'create_date', property: 'create_date', value: submission.create_date },
    { id: 'create_user', property: 'create_user', value: submission.create_user }
  ];

  return (
    <PageSection id="submission-metadata" label="Metadata">
      <CustomDataGrid autoHeight rows={rows} columns={columns} disableColumnSelector hideFooter rowSelection={false} />
      <SubmissionDefaultBlueprintDialog
        open={blueprintDialogOpen}
        submissionId={submissionId}
        blueprint={defaultBlueprint}
        onClose={() => setBlueprintDialogOpen(false)}
      />
    </PageSection>
  );
};
