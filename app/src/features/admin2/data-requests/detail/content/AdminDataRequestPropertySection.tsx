import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { ReactNode } from 'react';

export interface AdminDataRequestPropertyRow {
  id: string;
  property: string;
  value: ReactNode;
}

const columns: GridColDef<AdminDataRequestPropertyRow>[] = [
  { field: 'property', headerName: 'Property', flex: 0.3, sortable: false },
  {
    field: 'value',
    headerName: 'Value',
    flex: 0.7,
    sortable: false,
    renderCell: (params) => params.row.value
  }
];

interface AdminDataRequestPropertySectionProps {
  id: string;
  label: string;
  rows: AdminDataRequestPropertyRow[];
  /** Optional actions shown in the section header. */
  headerContent?: ReactNode;
  /** Hides the Property and Value column headers, for a section whose rows read as plain key and value pairs. */
  hideColumnHeaders?: boolean;
}

/**
 * One tab of the administrative data request page: a titled section listing properties and their values, using the
 * shared About section grid pattern. Rows grow to fit their value, so a long value wraps instead of being cut off.
 *
 * @param {AdminDataRequestPropertySectionProps} props Section id, title, the property rows to list, optional header
 * actions and whether the column headers are hidden.
 * @returns {JSX.Element} Properties as property and value rows.
 */
export const AdminDataRequestPropertySection = ({
  id,
  label,
  rows,
  headerContent,
  hideColumnHeaders = false
}: AdminDataRequestPropertySectionProps) => {
  return (
    <PageSection id={id} label={label} headerContent={headerContent}>
      <CustomDataGrid
        autoHeight
        rows={rows}
        columns={columns}
        disableColumnSelector
        hideFooter
        rowSelection={false}
        getRowHeight={() => 'auto'}
        sx={{
          '& .MuiDataGrid-columnHeaders': { display: hideColumnHeaders ? 'none' : undefined },
          // A long value wraps and its row grows, so the whole value is always visible.
          '& .MuiDataGrid-cell': {
            alignItems: 'flex-start',
            py: 2,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere'
          }
        }}
      />
    </PageSection>
  );
};
