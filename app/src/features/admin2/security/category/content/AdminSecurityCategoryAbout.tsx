import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { ISecurityCategoryDetails } from 'interfaces/useSecurityApi.interface';
import { getFormattedDate } from 'utils/Utils';

interface AdminSecurityCategoryAboutRow {
  id: string;
  property: string;
  value: string | null;
}

const columns: GridColDef<AdminSecurityCategoryAboutRow>[] = [
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

interface AdminSecurityCategoryAboutProps {
  category: ISecurityCategoryDetails;
}

/**
 * Displays a security category's description and creation details using the shared About section grid pattern.
 *
 * @param {AdminSecurityCategoryAboutProps} props Category whose details are displayed.
 * @returns {JSX.Element} Category details as property and value rows.
 */
export const AdminSecurityCategoryAbout = ({ category }: AdminSecurityCategoryAboutProps) => {
  const rows: AdminSecurityCategoryAboutRow[] = [
    { id: 'description', property: 'Description', value: category.description },
    {
      id: 'create_date',
      property: 'Created Date',
      value: getFormattedDate(DATE_FORMAT.ShortMediumDateTimeFormat, category.create_date)
    },
    { id: 'created_by_name', property: 'Created By', value: category.created_by_name }
  ];

  return (
    <PageSection id="security-category-about" label="About">
      <CustomDataGrid autoHeight rows={rows} columns={columns} disableColumnSelector hideFooter rowSelection={false} />
    </PageSection>
  );
};
