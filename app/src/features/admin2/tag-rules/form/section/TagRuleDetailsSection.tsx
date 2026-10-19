import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import CustomAutocompleteFormik from 'components/fields/CustomAutocompleteFormik';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { PageSection } from 'components/section/PageSection';
import { TagChip } from 'components/tags/TagChip';
import { TAG_SEARCH_LIMIT } from 'constants/tag';
import { TAG_RULE_DESCRIPTION_MAX_LENGTH, TAG_RULE_NAME_MAX_LENGTH } from 'constants/tag-rule';
import { useFormikContext } from 'formik';
import { useApi } from 'hooks/useApi';
import useDebouncedValue from 'hooks/useDebouncedValue';
import { ITagsQueryParams, ITagSummary } from 'interfaces/useTagsApi.interface';
import { useState } from 'react';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';
import { ITagRuleFormValues } from '../tag-rule-form-values';

/**
 * Rule section of the tag rule form: the tag the rule applies, its name and description, and whether it is enabled.
 *
 * The tag picker searches tags by name as the user types. Its options are the first page of matching tags plus the
 * picked tag, so an existing rule's tag shows whether or not the search matches it.
 *
 * @returns {JSX.Element} The rule details section.
 */
export const TagRuleDetailsSection = () => {
  const { values, setFieldValue } = useFormikContext<ITagRuleFormValues>();
  const api = useApi();

  const [inputValue, setInputValue] = useState('');
  const debouncedSearch = useDebouncedValue(inputValue);

  const searchParams: ITagsQueryParams = { search: debouncedSearch, page: 1, limit: TAG_SEARCH_LIMIT };
  const tagsQuery = useQuery({
    queryKey: tagQueryKeys.list(searchParams),
    queryFn: ({ signal }) => api.tags.getTags(searchParams, { signal }),
    placeholderData: keepPreviousData
  });

  const matchingTags: ITagSummary[] = tagsQuery.data?.tags ?? [];
  const pickedTag = values.tag;
  const tags =
    pickedTag && !matchingTags.some((tag) => tag.tag_id === pickedTag.tag_id)
      ? [...matchingTags, pickedTag]
      : matchingTags;
  const tagOptions = tags.map((tag) => ({ value: tag.tag_id, label: tag.name }));
  const pickedOption = pickedTag ? { value: pickedTag.tag_id, label: pickedTag.name } : null;

  return (
    <PageSection id="tag-rule-details" label="Rule">
      <Stack gap={2} sx={{ p: 2 }}>
        <CustomAutocompleteFormik<string>
          id="tag"
          name="tag"
          label="Tag"
          required
          placeholder="Search tags"
          loading={tagsQuery.isFetching}
          options={tagOptions}
          value={pickedOption}
          // The server matches the search; options are not filtered again here.
          filterOptions={(options) => options}
          onInputChange={(_event, nextInputValue, reason) => {
            if (reason === 'input' || reason === 'clear') {
              setInputValue(nextInputValue);
            }
          }}
          onChange={(_event, option) => setFieldValue('tag', tags.find((tag) => tag.tag_id === option?.value) ?? null)}
          renderOption={(optionProps, option) => {
            const { key, ...liProps } = optionProps;
            const tag = tags.find((item) => item.tag_id === option.value);
            return (
              <li {...liProps} key={key}>
                {tag ? <TagChip tag={tag} /> : option.label}
              </li>
            );
          }}
        />
        <CustomTextFieldFormik
          label="Name"
          name="name"
          required
          slotProps={{ htmlInput: { maxLength: TAG_RULE_NAME_MAX_LENGTH } }}
        />
        <CustomTextFieldFormik
          label="Description"
          name="description"
          multiline
          minRows={2}
          slotProps={{ htmlInput: { maxLength: TAG_RULE_DESCRIPTION_MAX_LENGTH } }}
        />
        <FormControlLabel
          label="Enabled"
          control={
            <Switch checked={values.isEnabled} onChange={(event) => setFieldValue('isEnabled', event.target.checked)} />
          }
        />
      </Stack>
    </PageSection>
  );
};
