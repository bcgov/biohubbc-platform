export interface ISearchResultCard {
  id: string;
  label: string;
  description?: string | null;
  [key: string]: string | number | boolean | undefined | null;
}
