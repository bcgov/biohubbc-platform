import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EditDialog } from 'components/dialog/EditDialog';
import { ICustomMultiAutocompleteOption } from 'components/fields/CustomMultiAutocomplete';
import { TAG_SEARCH_LIMIT } from 'constants/tag';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDebounce from 'hooks/useDebounce';
import { ITagsQueryParams } from 'interfaces/useTagsApi.interface';
import { useState } from 'react';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';
import { BoardTagAddForm, IBoardTagAddFormValues } from '../form/BoardTagAddForm';
import { BoardTagAddYupSchema } from '../form/BoardTagAddYupSchema';

interface IBoardTagAddDialogProps {
  open: boolean;
  boardId: string;
  onClose: () => void;
}

const BoardTagAddFormInitialValues: IBoardTagAddFormValues = {
  tagIds: []
};

/**
 * Dialog for linking existing tags to a board: search the tags and pick some. Saving links each, which puts the tickets
 * that have it on the board, and the tickets it is applied to later. The dialog closes on success and stays open on
 * failure, which is reported.
 *
 * @param {IBoardTagAddDialogProps} props The board, and the close handler.
 * @returns {JSX.Element} The add tags dialog.
 */
export const BoardTagAddDialog = (props: IBoardTagAddDialogProps) => {
  const { open, boardId, onClose } = props;
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const [tagSearch, setTagSearch] = useState('');

  const tagOptionsParams: ITagsQueryParams = { search: tagSearch, page: 1, limit: TAG_SEARCH_LIMIT };
  const tagOptionsQuery = useQuery({
    queryKey: tagQueryKeys.list(tagOptionsParams),
    queryFn: ({ signal }) => api.tags.getTags(tagOptionsParams, { signal }),
    enabled: open,
    placeholderData: keepPreviousData
  });

  const handleTagSearch = useDebounce(setTagSearch, 300);

  const addTagsMutation = useMutation({
    mutationFn: ({ tagIds }: IBoardTagAddFormValues) =>
      Promise.all(tagIds.map((tagId) => api.boards.addBoardTag(boardId, tagId))),
    onSuccess: (_data, { tagIds }) => {
      setSnackbar({
        open: true,
        snackbarMessage: tagIds.length === 1 ? 'Added 1 tag to the board' : `Added ${tagIds.length} tags to the board`
      });
      onClose();
    },
    onError: (error: Error) => setSnackbar({ open: true, snackbarMessage: error.message }),
    onSettled: () => refreshChangedQueries(queryClient, changedQueryKeys.boardTag())
  });

  const tagOptions: ICustomMultiAutocompleteOption[] = (tagOptionsQuery.data?.tags ?? []).map((tag) => ({
    value: tag.tag_id,
    label: tag.name
  }));

  return (
    <EditDialog<IBoardTagAddFormValues>
      open={open}
      dialogTitle="Add Tags"
      dialogSaveButtonLabel="Add"
      isLoading={addTagsMutation.isPending}
      component={{
        element: <BoardTagAddForm tagOptions={tagOptions} onTagSearch={handleTagSearch} />,
        initialValues: BoardTagAddFormInitialValues,
        validationSchema: BoardTagAddYupSchema
      }}
      onCancel={onClose}
      onSave={(values) => addTagsMutation.mutate(values)}
    />
  );
};
