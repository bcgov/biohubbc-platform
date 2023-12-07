import Icon from '@mdi/react';
import { mdiDotsVertical } from '@mdi/js';
import IconButton from '@mui/material/IconButton';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import grey from '@mui/material/colors/grey';

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
        <Icon path={mdiDotsVertical} size={1} />
      </IconButton>
    ],
  },
];

const rows = [
  { 
    id: 1, 
    securityRuleName: 'Security Rule Title', 
    securityRuleCategory: 'Persecution and Harm',
    securityRuleDesc: 'Description of this security rule.',
    securityRuleAssignments: 33, 
    securityRuleMatches: 39 },
  { id: 2, 
    securityRuleName: 'Security Rule Title',
    securityRuleDesc: 'Description of this security rule.',
    securityRuleCategory: 'Persecution and Harm', 
    securityRuleAssignments: 33, 
    securityRuleMatches: 39 },
];

const isLoading = false;

export default function ManageSecurityRulesTable() {
  return (
    <>
      {isLoading ? (
        <Box
          sx={{
            '& .MuiSkeleton-root': {
              transform: 'none'
            },
          }}
        >
          <Stack
            flexDirection="row"
            alignItems="center"
            height={56}
            sx={{
              borderBottom: '1px solid' + grey[300]
            }}
          >
            <Box width={50} px={2}>
              <Skeleton animation="pulse" height={18} width={18} sx={{ flex: '0 0 auto', transform: 'none' }}></Skeleton>
            </Box>
            <Box flex="1 1 auto" px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
            <Box width={250} px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
            <Box width={200} px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
            <Box width={200} px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
            <Box width={80} px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
          </Stack>
          <Stack
            flexDirection="row"
            alignItems="center"
            height={52}
            sx={{
              borderBottom: '1px solid' + grey[300]
            }}
          >
            <Box width={50} px={2}>
              <Skeleton animation="pulse" height={18} width={18} sx={{ flex: '0 0 auto', transform: 'none' }}></Skeleton>
            </Box>
            <Box flex="1 1 auto" px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
            <Box width={250} px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
            <Box width={200} px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
            <Box width={200} px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
            <Box width={80} px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
          </Stack>
          <Stack
            flexDirection="row"
            alignItems="center"
            height={52}
          >
            <Box width={50} px={2}>
              <Skeleton animation="pulse" height={18} width={18} sx={{ flex: '0 0 auto', transform: 'none' }}></Skeleton>
            </Box>
            <Box flex="1 1 auto" px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
            <Box width={250} px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
            <Box width={200} px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
            <Box width={200} px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
            <Box width={80} px={1.25}>
              <Skeleton animation="pulse" height={18}></Skeleton>
            </Box>
          </Stack>
        </Box>
      ) : (
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
      )}
    </>
  );
}