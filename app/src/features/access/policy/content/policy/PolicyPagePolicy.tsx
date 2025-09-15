import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Toolbar,
  Typography,
} from '@mui/material';
import { IPolicy } from 'interfaces/usePolicyApi.interface';
import { useState } from 'react';
import { PolicyCreateButton } from './create/PolicyCreateButton';

export interface IPolicyPagePolicyProps {
  policies: IPolicy[];
}

export const PolicyPagePolicy: React.FC<IPolicyPagePolicyProps> = ({ policies }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  return (
    <>
      <Toolbar sx={{ justifyContent: 'space-between', alignItems: 'center', mx: 2 }} disableGutters>
        <Typography variant="h4">
          Policies &zwnj;
          <Typography component="span" color="textSecondary">
            ({policies.length})
          </Typography>
        </Typography>
        <PolicyCreateButton />
      </Toolbar>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {policies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} align="center">
                  No Policies
                </TableCell>
              </TableRow>
            ) : (
              policies.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((policy) => (
                <TableRow key={policy.name}>
                  <TableCell>{policy.name}</TableCell>
                  <TableCell>{policy.description || 'No description'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {policies.length > 0 && (
        <TablePagination
          component="div"
          count={policies.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[50, 100, 200]}
        />
      )}
    </>
  );
};
