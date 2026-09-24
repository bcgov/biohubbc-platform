import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { IContributor } from 'interfaces/useContributorsApi.interface';

interface ContributorAboutRow {
  id: string;
  property: string;
  value: string | number | null;
}

const columns: GridColDef<ContributorAboutRow>[] = [
  { field: 'property', headerName: 'Property', flex: 0.3 },
  {
    field: 'value',
    headerName: 'Value',
    flex: 0.7,
    renderCell: (params) => (
      <Typography variant="body2" noWrap title={params.value} sx={{ width: '100%' }}>
        {params.value}
      </Typography>
    )
  }
];

/**
 * Displays contributor metadata using the shared About section grid pattern.
 *
 * @param props - Contributor whose metadata is displayed.
 * @returns Contributor metadata as property and value rows.
 */
export const ContributorAbout = ({ contributor }: { contributor: IContributor }) => {
  const rows: ContributorAboutRow[] = [
    { id: 'contributor_id', property: 'contributor_id', value: contributor.contributor_id },
    { id: 'client_id', property: 'client_id', value: contributor.client_id },
    { id: 'description', property: 'description', value: contributor.description },
    { id: 'record_end_date', property: 'record_end_date', value: contributor.record_end_date }
  ];

  return (
    <PageSection id="contributor-about" label="About">
      <CustomDataGrid autoHeight rows={rows} columns={columns} disableColumnSelector hideFooter rowSelection={false} />
    </PageSection>
  );
};
