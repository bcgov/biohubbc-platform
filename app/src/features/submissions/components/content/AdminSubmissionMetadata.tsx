import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';

interface SubmissionMetadataRow {
  id: string;
  property: string;
  value: string | number | null;
}

const columns: GridColDef<SubmissionMetadataRow>[] = [
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
];

/**
 * Display submission identity, contributor and creation fields in the standard metadata grid.
 *
 * @param props Submission whose metadata is displayed.
 * @returns {JSX.Element} Metadata page section.
 */
export const AdminSubmissionMetadata = ({ submission }: { submission: SubmissionRecordWithSecurity }) => {
  const rows: SubmissionMetadataRow[] = [
    { id: 'submission_id', property: 'submission_id', value: submission.submission_id },
    { id: 'uuid', property: 'uuid', value: submission.uuid },
    { id: 'contributor_name', property: 'contributor_name', value: submission.contributor_name },
    { id: 'create_date', property: 'create_date', value: submission.create_date },
    { id: 'create_user', property: 'create_user', value: submission.create_user }
  ];

  return (
    <PageSection id="submission-metadata" label="Metadata">
      <CustomDataGrid autoHeight rows={rows} columns={columns} disableColumnSelector hideFooter rowSelection={false} />
    </PageSection>
  );
};
