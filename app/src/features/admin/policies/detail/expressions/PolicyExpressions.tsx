import { mdiDotsVertical, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import { GridColDef } from '@mui/x-data-grid';
import { ContextMenuButton } from 'components/ContextMenuButton';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { IUseServerPaginatedDataGridReturn } from 'hooks/useServerPaginatedDataGrid';
import { IPolicyExpression, IPolicyExpressionsResponse } from 'interfaces/usePoliciesApi.interface';

interface PolicyExpressionsProps {
  expressions: IUseServerPaginatedDataGridReturn<IPolicyExpression, IPolicyExpressionsResponse>;
  onCreate: () => void;
  onEdit: (expression: IPolicyExpression) => void;
  onDelete: (expression: IPolicyExpression) => void;
}

/**
 * Expressions tab for the policy detail page.
 *
 * @param {PolicyExpressionsProps} props
 * @returns {JSX.Element}
 */
export const PolicyExpressions = ({ expressions, onCreate, onEdit, onDelete }: PolicyExpressionsProps) => {
  const columns: GridColDef<IPolicyExpression>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 220
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 260,
      valueGetter: (_value, row) => row.description ?? ''
    },
    {
      field: 'expression',
      headerName: 'Expression',
      flex: 2,
      minWidth: 360,
      sortable: false,
      renderCell: (params) => (
        <Box
          component="pre"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            lineHeight: 1.5,
            m: 0,
            overflow: 'visible',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
          {JSON.stringify(params.row.expression, null, 2)}
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <ContextMenuButton
          buttonTitle={`policy-expression-${params.row.policy_expression_id}-menu`}
          buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
          itemGroups={[
            {
              groupId: 'expression-actions',
              items: [
                {
                  label: 'Edit',
                  icon: <Icon path={mdiPencilOutline} size={0.875} />,
                  onClick: () => onEdit(params.row)
                },
                {
                  label: 'Delete',
                  icon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                  onClick: () => onDelete(params.row)
                }
              ]
            }
          ]}
        />
      )
    }
  ];

  return (
    <PageSection id="policy-expressions" label="Expressions" addLabel="Create Expression" onAdd={onCreate}>
      <ServerPaginatedDataGrid<IPolicyExpression>
        dataTestId="policy-expressions-table"
        rows={expressions.rows}
        columns={columns}
        getRowId={(row) => row.policy_expression_id}
        noRowsMessage="No Expressions"
        rowCount={expressions.rowCount}
        paginationModel={expressions.paginationModel}
        setPaginationModel={expressions.handlePaginationChange}
        sortModel={expressions.sortModel}
        setSortModel={expressions.handleSortChange}
        getRowHeight={() => 'auto'}
        getEstimatedRowHeight={() => 160}
        sx={{
          '& .MuiDataGrid-cell': {
            alignItems: 'flex-start',
            py: 1.5
          },
          '& .MuiDataGrid-cell[data-field="expression"] > *': {
            overflow: 'visible',
            whiteSpace: 'normal'
          }
        }}
      />
    </PageSection>
  );
};
