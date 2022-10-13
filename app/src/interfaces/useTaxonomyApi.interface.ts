export interface ITaxonomySearchResponse {
  searchResponse: Array<{
    id: string;
    code: string;
    label: string;
  }>;
}

export interface ITaxonomyListRespone {
  searchResponse: Array<{
    id: string;
    label: string;
  }>;
}
