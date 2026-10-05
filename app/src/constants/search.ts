import { ToggleButtonView } from 'components/toggle-button/ToggleButtons';
import { ApiPaginationRequestOptions } from 'types/pagination';

export enum SEARCH_RESULT_VIEW {
  TABLE = 'table',
  LIST = 'list',
  MAP = 'map'
}

export const SEARCH_RESULT_VIEW_OPTIONS: ToggleButtonView<SEARCH_RESULT_VIEW>[] = [
  { value: SEARCH_RESULT_VIEW.TABLE, label: 'Table' },
  { value: SEARCH_RESULT_VIEW.MAP, label: 'Map' }
];

/** Page of records previewed under the landing-page search box. */
export const SEARCH_PREVIEW_PAGINATION: ApiPaginationRequestOptions = { limit: 3, page: 1 };

/** Delay in ms between the last keystroke in the landing-page search box and its preview search. */
export const SEARCH_PREVIEW_DEBOUNCE_MS = 400;
