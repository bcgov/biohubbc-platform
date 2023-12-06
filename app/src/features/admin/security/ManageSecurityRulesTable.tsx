import Icon from '@mdi/react';
import { mdiDotsVertical } from '@mdi/js';
import IconButton from '@mui/material/IconButton';
import { DataGrid, GridColDef } from '@mui/x-data-grid';

const columns: GridColDef[] = [
  {
    field: 'securityRuleName',
    headerName: 'Name',
    editable: false,
    disableColumnMenu: true,
    flex: 1
  },
  {
    field: 'securityRuleCategory',
    headerName: 'Category',
    editable: false,
    disableColumnMenu: true,
    flex: 1,
    maxWidth: 250
  },
  {
    field: 'securityRuleAssignments',
    headerName: 'Assignments',
    editable: false,
    disableColumnMenu: true,
    flex: 1,
    maxWidth: 200,
    headerAlign: 'right',
    align: 'right'
  },
  {
    field: 'securityRuleMatches',
    headerName: 'Matches',
    editable: false,
    disableColumnMenu: true,
    flex: 1,
    maxWidth: 200,
    headerAlign: 'right',
    align: 'right'
  },
  {
    field: 'actions',
    type: 'actions',
    width: 80,
    getActions: (params) => [
      <IconButton>
        <Icon path={mdiDotsVertical} size={1}/>
      </IconButton>
    ],
  },
];

const rows = [
  { id: 1, securityRuleName: 'Security Rule Title', securityRuleCategory: 'Persecution and Harm', securityRuleAssignments: 33, securityRuleMatches: 39 },
  { id: 2, securityRuleName: 'Security Rule Title', securityRuleCategory: 'Persecution and Harm', securityRuleAssignments: 33, securityRuleMatches: 39 },
];

export default function ManageSecurityRulesTable() {
  return (

    <DataGrid
      rows={rows}
      columns={columns}
      autoHeight
      checkboxSelection
      disableRowSelectionOnClick
      sx={{
        '& .MuiDataGrid-columnHeaderTitle': {
          fontWeight: 700
        }
      }}
    />

  );
}