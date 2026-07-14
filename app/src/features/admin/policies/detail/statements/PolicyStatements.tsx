import { mdiDotsVertical, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Chip from '@mui/material/Chip';
import { GridColDef } from '@mui/x-data-grid';
import { ContextMenuButton } from 'components/ContextMenuButton';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { IPolicy, IPolicyStatement } from 'interfaces/usePoliciesApi.interface';

interface PolicyStatementsProps {
  policy: IPolicy;
  onCreate: () => void;
  onEdit: (statement: IPolicyStatement) => void;
  onDelete: (statement: IPolicyStatement) => void;
}

/**
 * Statements tab for the policy detail page.
 *
 * @param {PolicyStatementsProps} props
 * @returns {JSX.Element}
 */
export const PolicyStatements = ({ policy, onCreate, onEdit, onDelete }: PolicyStatementsProps) => {
  const columns: GridColDef<IPolicyStatement>[] = [
    {
      field: 'effect',
      headerName: 'Effect',
      minWidth: 140,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.row.effect}
          color={params.row.effect === 'allow' ? 'success' : 'error'}
          variant="outlined"
          sx={{ textTransform: 'capitalize' }}
        />
      )
    },
    {
      field: 'submission_feature_urn',
      headerName: 'URN',
      flex: 1,
      minWidth: 260
    },
    {
      field: 'policy_expression',
      headerName: 'Expression',
      flex: 1,
      minWidth: 220,
      valueGetter: (_value, row) => {
        const policyExpression = policy.expressions.find(
          (expression) => expression.policy_expression_id === row.policy_expression_id
        );

        return policyExpression?.name || row.policy_expression_id || '';
      }
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
          buttonTitle={`policy-statement-${params.row.policy_statement_id}-menu`}
          buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
          itemGroups={[
            {
              groupId: 'statement-actions',
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
    <PageSection id="policy-statements" label="Statements" addLabel="Create Statement" onAdd={onCreate}>
      <CustomDataGrid
        data-testid="policy-statements-table"
        rows={policy.statements}
        columns={columns}
        getRowId={(row) => row.policy_statement_id}
        disableRowSelectionOnClick
        disableColumnSelector
        noRowsMessage="No Statements"
        hideFooter
        autoHeight
        sx={{ border: 'none' }}
      />
    </PageSection>
  );
};
