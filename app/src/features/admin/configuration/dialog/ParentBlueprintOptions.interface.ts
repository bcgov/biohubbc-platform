import { ICustomAutocompleteOption } from 'components/fields/CustomAutocomplete';

export interface IParentBlueprintOption extends ICustomAutocompleteOption<number> {
  description: string;
}

export interface IParentBlueprintOptions {
  options: IParentBlueprintOption[];
  searchOptions: IParentBlueprintOption[];
  loading: boolean;
  error: string;
  onSearch: (keyword: string) => void;
  onSelect: (option: IParentBlueprintOption | null) => void;
}
