import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import SearchTextField from 'components/fields/SearchTextField';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDebouncedValue from 'hooks/useDebouncedValue';
import { ITag } from 'interfaces/useTagsApi.interface';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useCallback, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';
import { TagDialog } from './dialog/TagDialog';
import { ITagFormValues } from './form/TagForm';
import { AdminTagsTable } from './table/AdminTagsTable';

/**
 * Administrative tags page: the searchable list of ticket tags, with create, edit and delete.
 *
 * A save keeps its dialog open and shows the server's error, such as a duplicate name, in the dialog. Deleting a tag
 * removes it from every ticket, board and swimlane, so its confirmation says so; tag changes refresh everything that
 * shows tags.
 *
 * @returns {JSX.Element} The tags page.
 */
export const AdminTagsPage = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ITag | undefined>();

  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const listParams = { search: debouncedSearchTerm || undefined };
  const tagsQuery = useQuery({
    queryKey: tagQueryKeys.list(listParams),
    queryFn: ({ signal }) => api.tags.getTags(listParams, { signal }),
    placeholderData: keepPreviousData
  });

  /**
   * Closes the tag dialog and forgets the tag it was editing and its last error.
   *
   * @returns {void}
   */
  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTag(undefined);
    saveTagMutation.reset();
  };

  const saveTagMutation = useMutation({
    mutationFn: ({ tag, values }: { tag: ITag | undefined; values: ITagFormValues }) => {
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        color: values.color
      };

      if (tag) {
        return api.tags.updateTag(tag.tag_id, payload);
      }

      return api.tags.createTag(payload);
    },
    onSuccess: (savedTag, { tag }) => {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: tag ? `Updated tag ${savedTag.name}` : `Created tag ${savedTag.name}`
      });
      closeDialog();
      void refreshChangedQueries(queryClient, changedQueryKeys.tag());
    }
  });

  const deleteTagMutation = useMutation({
    mutationFn: (tag: ITag) => api.tags.deleteTag(tag.tag_id),
    onSuccess: (_data, tag) => {
      dialogContext.setSnackbar({ open: true, snackbarMessage: `Deleted tag ${tag.name}` });
      void refreshChangedQueries(queryClient, changedQueryKeys.tag());
    },
    onError: (error: Error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
  });
  const { mutate: deleteTag } = deleteTagMutation;

  const handleEditTag = useCallback((tag: ITag) => {
    setEditingTag(tag);
    setIsDialogOpen(true);
  }, []);

  /**
   * Asks for confirmation before deleting a tag, which also removes it from every ticket, board and swimlane.
   *
   * @param {ITag} tag The tag to delete.
   * @returns {void}
   */
  const handleDeleteTag = useCallback(
    (tag: ITag) => {
      const closeConfirmation = () => dialogContext.setYesNoDialog({ open: false });

      dialogContext.setYesNoDialog({
        open: true,
        dialogTitle: 'Delete tag?',
        dialogContent: (
          <Typography component="div" color="textSecondary">
            Deleting tag <strong>{tag.name}</strong> removes it from all tickets, boards and swimlanes. This cannot be
            undone. Are you sure you want to proceed?
          </Typography>
        ),
        yesButtonLabel: 'Delete Tag',
        noButtonLabel: 'Cancel',
        yesButtonProps: { color: 'error' },
        onClose: closeConfirmation,
        onNo: closeConfirmation,
        onYes: () => {
          closeConfirmation();
          deleteTag(tag);
        }
      });
    },
    [deleteTag, dialogContext]
  );

  const tags = tagsQuery.data?.tags ?? [];

  return (
    <>
      <AdminPageLayout
        title="Tags"
        breadcrumbs={
          <Breadcrumbs aria-label="tags breadcrumb">
            <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
              Administration
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              Tags
            </Typography>
          </Breadcrumbs>
        }
        tabs={[{ value: 'tags', label: 'Tags', id: 'tags-tab', ariaControls: 'tags-panel' }]}
        activeTab="tags"
        onTabChange={() => {}}>
        <Box id="tags-panel" role="tabpanel" aria-labelledby="tags-tab">
          <QueryErrorDialog error={tagsQuery.error} label="tags" />
          <PageSection
            id="tags"
            label={
              <>
                Tags{' '}
                <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
                  ({tags.length})
                </Typography>
              </>
            }
            onAdd={() => setIsDialogOpen(true)}
            addLabel="New Tag"
            headerContent={
              <SearchTextField
                size="small"
                placeholder="Search by tag name"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            }>
            <AdminTagsTable
              tags={tags}
              isLoading={tagsQuery.isPending}
              onEditTag={handleEditTag}
              onDeleteTag={handleDeleteTag}
            />
          </PageSection>
        </Box>
      </AdminPageLayout>

      <TagDialog
        open={isDialogOpen}
        tag={editingTag}
        isLoading={saveTagMutation.isPending}
        dialogError={saveTagMutation.error?.message}
        onCancel={closeDialog}
        onSave={(values) => saveTagMutation.mutate({ tag: editingTag, values })}
      />
    </>
  );
};
