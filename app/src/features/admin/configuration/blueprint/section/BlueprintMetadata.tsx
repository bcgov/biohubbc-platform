import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { IBlueprint } from 'interfaces/useBlueprintsApi.interface';

interface IBlueprintMetadataRow {
  id: string;
  property: string;
  value: string;
}

const columns: GridColDef<IBlueprintMetadataRow>[] = [
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
 * Display blueprint identity and lifecycle metadata as key-value pairs.
 *
 * @param props Blueprint metadata confirmed by the server.
 * @returns Metadata section using the existing About-table layout.
 */
export const BlueprintMetadata = ({ blueprint }: { blueprint: IBlueprint }) => {
  const rows: IBlueprintMetadataRow[] = [
    { id: 'identifier', property: 'ID', value: String(blueprint.blueprint_id) },
    { id: 'version', property: 'Version', value: String(blueprint.version_number) },
    {
      id: 'parent',
      property: 'Parent blueprint',
      value: blueprint.parent_blueprint_id === null ? '' : String(blueprint.parent_blueprint_id)
    },
    { id: 'default', property: 'Default', value: blueprint.is_default ? 'Yes' : 'No' },
    { id: 'effective-date', property: 'Effective date', value: blueprint.record_effective_date ?? '' },
    { id: 'end-date', property: 'End date', value: blueprint.record_end_date ?? '' }
  ];

  return (
    <PageSection id="blueprint-metadata" label="Metadata">
      <CustomDataGrid autoHeight rows={rows} columns={columns} disableColumnSelector hideFooter rowSelection={false} />
    </PageSection>
  );
};
