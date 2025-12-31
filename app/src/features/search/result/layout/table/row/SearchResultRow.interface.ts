export interface ISearchResultRow {
  id: string;
  label: string;
  description?: string | null;
  [key: string]: string | number | boolean | undefined | null;
}
