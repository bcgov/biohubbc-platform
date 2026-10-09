import { GridColDef } from '@mui/x-data-grid';
import { ConfigurationStatusChip } from './ConfigurationStatusChip';
import { getConfigurationStatus } from '../utils/lifecycleStatus';
import { mdiDotsVertical, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';

interface ConfigurationDefinitionActionsProps {
  name: string;
  busy: boolean;
  onEdit: () => void;
  onRetire: () => void;
}

/**
 * Show the shared edit and retire actions for reusable configuration definitions.
 *
 * @param props Definition name, pending state, and owning section's action handlers.
 * @returns Accessible actions menu.
 */
export const ConfigurationDefinitionActions = ({
  name,
  busy,
  onEdit,
  onRetire
}: ConfigurationDefinitionActionsProps) => (
  <CustomMenuIconButton
    buttonTitle={`Actions for ${name}`}
    buttonProps={{ disabled: busy, size: 'small' }}
    buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
    menuItems={[
      { menuLabel: 'Edit', menuIcon: <Icon path={mdiPencilOutline} size={0.875} />, menuOnClick: onEdit },
      { menuLabel: 'Retire', menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />, menuOnClick: onRetire }
    ]}
  />
);

interface ConfigurationDefinition {
  name: string;
  record_effective_date?: string | null;
  record_end_date?: string | null;
}

/**
 * Build identical lifecycle and action columns for reusable configuration definitions.
 *
 * @param busy Whether a definition mutation is pending.
 * @param onEdit Open the owning section's metadata editor.
 * @param onRetire Confirm retirement in the owning section.
 * @returns Status and actions columns for a definition table.
 */
export const getConfigurationDefinitionColumns = <T extends ConfigurationDefinition>(
  busy: boolean,
  onEdit: (record: T) => void,
  onRetire: (record: T) => void
): GridColDef<T>[] => [
  {
    field: 'status',
    headerName: 'Status',
    minWidth: 140,
    flex: 0.8,
    sortable: false,
    valueGetter: (_value, row) => getConfigurationStatus(row),
    renderCell: ({ value }) => <ConfigurationStatusChip status={value} />
  },
  {
    field: 'actions',
    headerName: 'Actions',
    width: 100,
    sortable: false,
    renderCell: ({ row }) => (
      <ConfigurationDefinitionActions
        name={row.name}
        busy={busy}
        onEdit={() => onEdit(row)}
        onRetire={() => onRetire(row)}
      />
    )
  }
];
