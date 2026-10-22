import Stack from '@mui/material/Stack';
import { SearchAutocomplete } from 'components/search/SearchAutocomplete';
import { SearchOption } from 'components/search/SearchAutocomplete.interface';
import { useFormikContext } from 'formik';
import { ITagSummary } from 'interfaces/useTagsApi.interface';
import { TicketTagCard } from './TicketTagCard';

export interface ITicketTagFormValues {
  /** The ticket's complete tag set. */
  tags: ITagSummary[];
}

interface ITicketTagFormProps {
  /** The tags matching the search, which can be added unless the ticket already has them. */
  matchingTags: ITagSummary[];
  isLoadingTags: boolean;
  isSubmitting: boolean;
  onSearchTags: (search: string) => void;
}

/**
 * Form body for a ticket's tags: a search of every tag that adds the picked tag, above the ticket's tags as a vertical
 * stack of cards, each removable. Rendered inside an `EditDialog`, which owns the Formik state.
 *
 * @param {ITicketTagFormProps} props The matching tags and the search handler.
 * @returns {JSX.Element} The ticket tag form.
 */
export const TicketTagForm = (props: ITicketTagFormProps) => {
  const { matchingTags, isLoadingTags, isSubmitting, onSearchTags } = props;
  const { values, setFieldValue } = useFormikContext<ITicketTagFormValues>();

  const pickedTagIds = new Set(values.tags.map((tag) => tag.tag_id));
  const options: SearchOption[] = matchingTags
    .filter((tag) => !pickedTagIds.has(tag.tag_id))
    .map((tag) => ({ value: tag.tag_id, label: tag.name }));

  /**
   * Adds a picked tag to the ticket's tags.
   *
   * @param {SearchOption | null} option The picked search option.
   * @returns {void}
   */
  const handleSelectTag = (option: SearchOption | null) => {
    const pickedTag = matchingTags.find((tag) => tag.tag_id === option?.value);

    if (pickedTag) {
      void setFieldValue('tags', [...values.tags, pickedTag]);
    }
  };

  return (
    <Stack spacing={2.5} sx={{ mt: 1 }}>
      <SearchAutocomplete
        options={options}
        value={null}
        size="medium"
        placeholder="Search tags"
        loading={isLoadingTags}
        disabled={isSubmitting}
        onInputChange={onSearchTags}
        onChange={handleSelectTag}
      />

      {values.tags.length ? (
        <Stack spacing={1}>
          {values.tags.map((tag) => (
            <TicketTagCard
              key={tag.tag_id}
              tag={tag}
              isSubmitting={isSubmitting}
              onRemoveTag={() =>
                setFieldValue(
                  'tags',
                  values.tags.filter((pickedTag) => pickedTag.tag_id !== tag.tag_id)
                )
              }
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
};
