export interface SearchParams {
  keyword: string;
}

export interface SearchTaxonFilters {
  keyword?: string;
}

export interface WithCount<T> {
  data: T[];
  total: number;
}
