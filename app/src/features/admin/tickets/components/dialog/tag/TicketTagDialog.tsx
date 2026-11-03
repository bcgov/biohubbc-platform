import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { EditDialog } from 'components/dialog/EditDialog';
import { TAG_SEARCH_LIMIT } from 'constants/tag';
import { useApi } from 'hooks/useApi';
import useDebounce from 'hooks/useDebounce';
import { ITagsQueryParams } from 'interfaces/useTagsApi.interface';
import { useMemo, useState } from 'react';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';
import { useTicketTagsQuery } from '../../../hooks/useTicketTagsQuery';
import { useUpdateTicketTagsMutation } from '../../../hooks/useUpdateTicketTagsMutation';
import { TicketTagDialogYup } from './TicketTagDialogYup';
import { ITicketTagFormValues, TicketTagForm } from './form/TicketTagForm';

interface ITicketTagDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog for the route's ticket's tags: it opens with the ticket's tags, adds tags found by searching every tag, removes
 * tags, and saves the complete set.
 *
 * @param {ITicketTagDialogProps} props Whether the dialog is open, and its close handler.
 * @returns {JSX.Element} The ticket tag dialog.
 */
export const TicketTagDialog = (props: ITicketTagDialogProps) => {
  const { open, onClose } = props;
  const api = useApi();
  const ticketTagsQuery = useTicketTagsQuery();
  const updateTicketTagsMutation = useUpdateTicketTagsMutation();
  const [tagSearch, setTagSearch] = useState('');

  const searchParams: ITagsQueryParams = { search: tagSearch, page: 1, limit: TAG_SEARCH_LIMIT };
  const matchingTagsQuery = useQuery({
    queryKey: tagQueryKeys.list(searchParams),
    queryFn: ({ signal }) => api.tags.getTags(searchParams, { signal }),
    enabled: open,
    placeholderData: keepPreviousData
  });

  const debouncedTagSearch = useDebounce(setTagSearch, 300);

  const ticketTags = ticketTagsQuery.data?.tags;
  // The dialog reinitializes its form when these change, so they change only with the ticket's tags.
  const initialValues = useMemo<ITicketTagFormValues>(() => ({ tags: ticketTags ?? [] }), [ticketTags]);

  /**
   * Saves the ticket's complete tag set; the dialog closes on success and stays open on failure, which the mutation
   * reports.
   *
   * @param {ITicketTagFormValues} values The ticket's tags.
   * @returns {void}
   */
  const handleSubmit = (values: ITicketTagFormValues) => {
    updateTicketTagsMutation.mutate(values.tags, { onSuccess: onClose });
  };

  return (
    <EditDialog<ITicketTagFormValues>
      isLoading={updateTicketTagsMutation.isPending}
      dialogTitle="Edit Tags"
      dialogSaveButtonLabel="Save"
      open={open}
      maxWidth="sm"
      component={{
        element: (
          <TicketTagForm
            matchingTags={matchingTagsQuery.data?.tags ?? []}
            isLoadingTags={matchingTagsQuery.isFetching}
            isSubmitting={updateTicketTagsMutation.isPending}
            onSearchTags={debouncedTagSearch}
          />
        ),
        initialValues,
        validationSchema: TicketTagDialogYup
      }}
      onCancel={onClose}
      onSave={handleSubmit}
    />
  );
};
