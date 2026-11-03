import { mdiDotsVertical, mdiMagnify, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ISnackbarProps } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ISecurityRuleWithFeatureCount } from 'interfaces/useSecurityApi.interface';
import { IServerPaginationProps } from 'types/pagination';
import { useCallback, useState } from 'react';
import { IAddRuleFormValues } from './AddRuleForm';
import { AddRuleFormInitialValues, RuleDialog } from './RuleDialog';

export interface IRulesContainerProps extends IServerPaginationProps {
  rules: ISecurityRuleWithFeatureCount[];
  /** Callback after create/update/delete, which refreshes the rules and categories (whose rule_count it changes) */
  refresh: () => void;
  searchTerm: string;
  onSearch: (term: string) => void;
  /**
   * The security category whose rules are listed. When set, the Category column is hidden and new rules default
   * to this category.
   */
  securityCategoryId?: number;
}

/**
 * Container component for managing security rules.
 *
 * Provides functionality to:
 * - View rules in a searchable, paginated table
 * - Create new rules via RuleDialog (EditDialog + Formik)
 * - Edit existing rules via RuleDialog
 * - Delete rules with confirmation
 *
 * @param {IRulesContainerProps} props
 * @returns {React.ReactElement}
 */
export const RulesContainer = (props: IRulesContainerProps) => {
  const {
    rules,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    refresh,
    searchTerm,
    onSearch,
    securityCategoryId
  } = props;

  const biohubApi = useApi();
  const dialogContext = useDialogContext();
  const { setErrorDialog } = dialogContext;
  const addRuleInitialValues: IAddRuleFormValues = {
    ...AddRuleFormInitialValues,
    security_category_id: securityCategoryId
  };

  const [openAddRuleDialog, setOpenAddRuleDialog] = useState(false);
  const [openEditRuleDialog, setOpenEditRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<ISecurityRuleWithFeatureCount | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const showSnackBar = (textDialogProps?: Partial<ISnackbarProps>) => {
    dialogContext.setSnackbar({ ...textDialogProps, open: true });
  };

  /**
   * Display API or load errors via the shared error dialog.
   *
   * @param {string} title
   * @param {string} text
   * @param {unknown} error
   */
  const showApiErrorDialog = useCallback(
    (title: string, text: string, error: unknown) => {
      const apiError = error as APIError;
      setErrorDialog({
        open: true,
        dialogTitle: title,
        dialogText: text,
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => setErrorDialog({ open: false }),
        onOk: () => setErrorDialog({ open: false })
      });
    },
    [setErrorDialog]
  );

  /**
   * Open confirmation dialog to delete a security rule.
   *
   * @param {ISecurityRuleWithFeatureCount} rule
   */
  const handleDeleteRuleClick = (rule: ISecurityRuleWithFeatureCount) => {
    dialogContext.setYesNoDialog({
      dialogTitle: 'Delete rule?',
      dialogContent: (
        <Typography variant="body1" component="div" color="textSecondary">
          Deleting rule <strong>{rule.name}</strong> will remove it permanently. Are you sure you want to proceed?
        </Typography>
      ),
      yesButtonLabel: 'Delete Rule',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: () => dialogContext.setYesNoDialog({ open: false }),
      onNo: () => dialogContext.setYesNoDialog({ open: false }),
      open: true,
      onYes: () => {
        dialogContext.setYesNoDialog({ open: false });
        void deleteRule(rule);
      }
    });
  };

  /**
   * Delete a security rule via API.
   *
   * @param {ISecurityRuleWithFeatureCount} rule
   * @returns {Promise<void>}
   */
  const deleteRule = async (rule: ISecurityRuleWithFeatureCount) => {
    try {
      await biohubApi.security.deleteSecurityRule(rule.security_rule_id);
      showSnackBar({ snackbarMessage: 'Deleted rule' });
      refresh();
    } catch (error) {
      showApiErrorDialog('Error Deleting Rule', 'An error occurred while deleting the rule.', error);
    }
  };

  /**
   * Open the edit dialog for a security rule.
   *
   * @param {ISecurityRuleWithFeatureCount} rule
   */
  const handleEditRuleClick = (rule: ISecurityRuleWithFeatureCount) => {
    setEditingRule(rule);
    setOpenEditRuleDialog(true);
  };

  /**
   * Handle saving a new security rule from the add dialog.
   *
   * @param {IAddRuleFormValues} values
   * @returns {Promise<void>}
   */
  const handleAddRuleSave = async (values: IAddRuleFormValues) => {
    if (!values.security_category_id) {
      return;
    }

    setIsLoading(true);

    try {
      await biohubApi.security.createSecurityRule({
        name: values.name,
        description: values.description,
        security_category_id: values.security_category_id,
        is_active: values.is_active
      });

      setOpenAddRuleDialog(false);
      refresh();
      showSnackBar({ snackbarMessage: 'Created rule' });
    } catch (error) {
      showApiErrorDialog('Failed to Create Rule', 'An error occurred while creating the rule.', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle saving an edited security rule.
   *
   * @param {IAddRuleFormValues} values
   * @returns {Promise<void>}
   */
  const handleEditRuleSave = async (values: IAddRuleFormValues) => {
    if (!editingRule || !values.security_category_id) {
      return;
    }

    setIsLoading(true);

    try {
      await biohubApi.security.updateSecurityRule(editingRule.security_rule_id, {
        name: values.name,
        description: values.description,
        security_category_id: values.security_category_id,
        is_active: values.is_active
      });

      setOpenEditRuleDialog(false);
      setEditingRule(null);
      refresh();
      showSnackBar({ snackbarMessage: 'Updated rule' });
    } catch (error) {
      showApiErrorDialog('Failed to Update Rule', 'An error occurred while updating the rule.', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get initial form values for the edit dialog.
   *
   * @returns {IAddRuleFormValues}
   */
  const getEditRuleInitialValues = (): IAddRuleFormValues => {
    if (!editingRule) {
      return AddRuleFormInitialValues;
    }

    return {
      name: editingRule.name,
      description: editingRule.description || '',
      security_category_id: editingRule.security_category_id,
      is_active: editingRule.is_active
    };
  };

  const allColumns: GridColDef<ISecurityRuleWithFeatureCount>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 150
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 2,
      minWidth: 200
    },
    {
      field: 'category_name',
      headerName: 'Category',
      flex: 1,
      minWidth: 150
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Active' : 'Inactive'}
          size="small"
          color={params.value ? 'success' : 'default'}
          sx={{ fontWeight: 700 }}
        />
      )
    },
    {
      field: 'feature_count',
      headerName: 'Features',
      width: 120,
      align: 'center',
      headerAlign: 'center'
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <CustomMenuIconButton
          buttonTitle="Actions"
          buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
          menuItems={[
            {
              menuIcon: <Icon path={mdiPencilOutline} size={0.875} />,
              menuLabel: 'Edit rule',
              menuOnClick: () => handleEditRuleClick(params.row)
            },
            {
              menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
              menuLabel: 'Delete rule',
              menuOnClick: () => handleDeleteRuleClick(params.row)
            }
          ]}
        />
      )
    }
  ];

  const columns = securityCategoryId ? allColumns.filter((column) => column.field !== 'category_name') : allColumns;

  return (
    <>
      <PageSection
        id="rules"
        label={
          <>
            Rules{' '}
            <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
              ({rowCount})
            </Typography>
          </>
        }
        onAdd={() => setOpenAddRuleDialog(true)}
        headerContent={
          <Stack gap={1} direction="row" alignItems="center">
            <TextField
              size="small"
              placeholder="Search by rule name"
              value={searchTerm}
              onChange={(e) => onSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon path={mdiMagnify} size={0.875} />
                    </InputAdornment>
                  )
                }
              }}
              sx={{ width: 250 }}
            />
          </Stack>
        }>
        <ServerPaginatedDataGrid<ISecurityRuleWithFeatureCount>
          dataTestId="rules-table"
          rows={rules}
          columns={columns}
          getRowId={(row) => row.security_rule_id}
          noRowsMessage="No Rules"
          rowCount={rowCount}
          paginationModel={paginationModel}
          setPaginationModel={setPaginationModel}
          sortModel={sortModel}
          setSortModel={setSortModel}
        />
      </PageSection>

      <RuleDialog
        open={openAddRuleDialog}
        isLoading={isLoading}
        dialogTitle="Add Rule"
        dialogSaveButtonLabel="Create"
        initialValues={addRuleInitialValues}
        onLoadError={showApiErrorDialog}
        onCancel={() => setOpenAddRuleDialog(false)}
        onSave={handleAddRuleSave}
      />

      <RuleDialog
        open={openEditRuleDialog}
        isLoading={isLoading}
        dialogTitle="Edit Rule"
        dialogSaveButtonLabel="Save"
        initialValues={getEditRuleInitialValues()}
        onLoadError={showApiErrorDialog}
        onCancel={() => {
          setOpenEditRuleDialog(false);
          setEditingRule(null);
        }}
        onSave={handleEditRuleSave}
      />
    </>
  );
};
