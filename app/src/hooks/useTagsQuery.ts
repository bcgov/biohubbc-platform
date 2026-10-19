import { useQuery } from '@tanstack/react-query';
import { ITagsQueryParams } from 'interfaces/useTagsApi.interface';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';
import { useApi } from './useApi';

/** Parameters of the unfiltered tag list that every tag picker shares. */
const ALL_TAGS_PARAMS: ITagsQueryParams = {};

/**
 * Loads every tag, ordered by name, for the tag pickers and filters. Tag changes refresh it through
 * `changedQueryKeys.tag`.
 *
 * @returns The tags query.
 */
export const useTagsQuery = () => {
  const api = useApi();

  return useQuery({
    queryKey: tagQueryKeys.list(ALL_TAGS_PARAMS),
    queryFn: ({ signal }) => api.tags.getTags(ALL_TAGS_PARAMS, { signal })
  });
};
