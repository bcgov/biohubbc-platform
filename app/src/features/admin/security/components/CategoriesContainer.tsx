import { mdiDotsVertical, mdiMagnify, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Container from '@mui/material/Container';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { EditDialog } from 'components/dialog/EditDialog';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ISnackbarProps } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ISecurityCategoryWithRuleCount } from 'interfaces/useSecurityApi.interface';
import { IServerPaginationProps } from 'types/pagination';
import { useState } from 'react';
import {
  AddCategoryForm,
  AddCategoryFormInitialValues,
  AddCategoryFormYupSchema,
  IAddCategoryFormValues
} from './AddCategoryForm';

export interface ICategoriesContainerProps extends IServerPaginationProps {
  categories: ISecurityCategoryWithRuleCount[];
  refresh: () => void;
  searchTerm: string;
  onSearch: (term: string) => void;
}

/**
 * Container component for managing security categories.
 *
 * Provides functionality to:
 * - View categories in a searchable, paginated table
 * - Create new categories via EditDialog
 * - Edit existing categories via EditDialog
 * - Delete categories with confirmation
 *
 * @param {ICategoriesContainerProps} props
 * @returns {React.ReactElement}
 */
export const CategoriesContainer = (props: ICategoriesContainerProps) => {
  const {
    categories,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    refresh,
    searchTerm,
    onSearch
  } = props;

  const biohubApi = useApi();
  const dialogContext = useDialogContext();

  const [openAddCategoryDialog, setOpenAddCategoryDialog] = useState(false);
  const [openEditCategoryDialog, setOpenEditCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ISecurityCategoryWithRuleCount | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const showSnackBar = (textDialogProps?: Partial<ISnackbarProps>) => {
    dialogContext.setSnackbar({ ...textDialogProps, open: true });
  };

  /**
   * Open confirmation dialog to delete a security category.
   *
   * @param {ISecurityCategoryWithRuleCount} category
   */
  const handleDeleteCategoryClick = (category: ISecurityCategoryWithRuleCount) => {
    dialogContext.setYesNoDialog({
      dialogTitle: 'Delete category?',
      dialogContent: (
        <Typography variant="body1" component="div" color="textSecondary">
          Deleting category <strong>{category.name}</strong> will remove it permanently. Are you sure you want to
          proceed?
        </Typography>
      ),
      yesButtonLabel: 'Delete Category',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: () => dialogContext.setYesNoDialog({ open: false }),
      onNo: () => dialogContext.setYesNoDialog({ open: false }),
      open: true,
      onYes: () => {
        dialogContext.setYesNoDialog({ open: false });
        deleteCategory(category);
      }
    });
  };

  /**
   * Delete a security category via API.
   *
   * @param {ISecurityCategoryWithRuleCount} category
   * @returns {Promise<void>}
   */
  const deleteCategory = async (category: ISecurityCategoryWithRuleCount) => {
    try {
      await biohubApi.security.deleteSecurityCategory(category.security_category_id);
      showSnackBar({ snackbarMessage: 'Deleted category' });
      refresh();
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Error Deleting Category',
        dialogText: 'An error occurred while deleting the category.',
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => dialogContext.setErrorDialog({ open: false }),
        onOk: () => dialogContext.setErrorDialog({ open: false })
      });
    }
  };

  /**
   * Open the edit dialog for a security category.
   *
   * @param {ISecurityCategoryWithRuleCount} category
   */
  const handleEditCategoryClick = (category: ISecurityCategoryWithRuleCount) => {
    setEditingCategory(category);
    setOpenEditCategoryDialog(true);
  };

  /**
   * Handle saving a new security category from the add dialog.
   *
   * @param {IAddCategoryFormValues} values
   * @returns {Promise<void>}
   */
  const handleAddCategorySave = async (values: IAddCategoryFormValues) => {
    setIsLoading(true);

    try {
      await biohubApi.security.createSecurityCategory({
        name: values.name,
        description: values.description
      });

      setOpenAddCategoryDialog(false);
      refresh();
      showSnackBar({ snackbarMessage: 'Created category' });
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Failed to Create Category',
        dialogText: 'An error occurred while creating the category.',
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => dialogContext.setErrorDialog({ open: false }),
        onOk: () => dialogContext.setErrorDialog({ open: false })
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle saving an edited security category.
   *
   * @param {IAddCategoryFormValues} values
   * @returns {Promise<void>}
   */
  const handleEditCategorySave = async (values: IAddCategoryFormValues) => {
    if (!editingCategory) {
      return;
    }

    setIsLoading(true);

    try {
      await biohubApi.security.updateSecurityCategory(editingCategory.security_category_id, {
        name: values.name,
        description: values.description
      });

      setOpenEditCategoryDialog(false);
      setEditingCategory(null);
      refresh();
      showSnackBar({ snackbarMessage: 'Updated category' });
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Failed to Update Category',
        dialogText: 'An error occurred while updating the category.',
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => dialogContext.setErrorDialog({ open: false }),
        onOk: () => dialogContext.setErrorDialog({ open: false })
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get initial form values for the edit dialog.
   *
   * @returns {IAddCategoryFormValues}
   */
  const getEditCategoryInitialValues = (): IAddCategoryFormValues => {
    if (!editingCategory) {
      return AddCategoryFormInitialValues;
    }

    return {
      name: editingCategory.name,
      description: editingCategory.description || ''
    };
  };

  const columns: GridColDef<ISecurityCategoryWithRuleCount>[] = [
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
      field: 'rule_count',
      headerName: 'Reasons',
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
              menuLabel: 'Edit category',
              menuOnClick: () => handleEditCategoryClick(params.row)
            },
            {
              menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
              menuLabel: 'Delete category',
              menuOnClick: () => handleDeleteCategoryClick(params.row)
            }
          ]}
        />
      )
    }
  ];

  return (
    <Container maxWidth="xl">
      <PageSection
        id="categories"
        label={
          <>
            Categories{' '}
            <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
              ({rowCount})
            </Typography>
          </>
        }
        onAdd={() => setOpenAddCategoryDialog(true)}
        headerContent={
          <Stack gap={1} direction="row" alignItems="center">
            <TextField
              size="small"
              placeholder="Search by category name"
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
        <ServerPaginatedDataGrid<ISecurityCategoryWithRuleCount>
          dataTestId="categories-table"
          rows={categories}
          columns={columns}
          getRowId={(row) => row.security_category_id}
          noRowsMessage="No Categories"
          rowCount={rowCount}
          paginationModel={paginationModel}
          setPaginationModel={setPaginationModel}
          sortModel={sortModel}
          setSortModel={setSortModel}
        />
      </PageSection>

      <EditDialog
        isLoading={isLoading}
        dialogTitle="Add Category"
        open={openAddCategoryDialog}
        dialogSaveButtonLabel="Create"
        component={{
          element: <AddCategoryForm />,
          initialValues: AddCategoryFormInitialValues,
          validationSchema: AddCategoryFormYupSchema
        }}
        onCancel={() => setOpenAddCategoryDialog(false)}
        onSave={handleAddCategorySave}
      />

      <EditDialog
        isLoading={isLoading}
        dialogTitle="Edit Category"
        open={openEditCategoryDialog}
        dialogSaveButtonLabel="Save"
        component={{
          element: <AddCategoryForm />,
          initialValues: getEditCategoryInitialValues(),
          validationSchema: AddCategoryFormYupSchema
        }}
        onCancel={() => {
          setOpenEditCategoryDialog(false);
          setEditingCategory(null);
        }}
        onSave={handleEditCategorySave}
      />
    </Container>
  );
};
