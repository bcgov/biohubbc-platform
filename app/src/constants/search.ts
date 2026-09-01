import { ToggleButtonView } from 'components/toggle-button/ToggleButtons';

export enum SEARCH_RESULT_VIEW {
  TABLE = 'table',
  LIST = 'list',
  MAP = 'map'
}

export const SEARCH_RESULT_VIEW_OPTIONS: ToggleButtonView<SEARCH_RESULT_VIEW>[] = [
  { value: SEARCH_RESULT_VIEW.TABLE, label: 'Table' },
  { value: SEARCH_RESULT_VIEW.MAP, label: 'Map' }
];
