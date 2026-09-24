import { ICustomAutocompleteOption } from 'components/fields/CustomAutocomplete';
import { ApiPaginationRequestOptions, ApiPaginationResponseParams } from 'types/pagination';

export interface ICompositionAutocompleteResponse {
  options: { id: number; name: string; display_name: string }[];
  pagination: ApiPaginationResponseParams;
}

export type CompositionOptionsFetcher = (
  keyword: string,
  pagination: ApiPaginationRequestOptions
) => Promise<ICompositionAutocompleteResponse>;

/**
 * Prepared selector state; selected labels may be retained outside matchingOptions.
 */
export interface ICompositionOptions {
  options: ICustomAutocompleteOption<number>[];
  matchingOptions: ICustomAutocompleteOption<number>[];
  loading: boolean;
  error: string;
  onSearch: (keyword: string) => void;
  onSelect: (option: ICustomAutocompleteOption<number> | null) => void;
}
