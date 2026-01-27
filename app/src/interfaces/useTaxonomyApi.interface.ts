export interface ITaxon {
  tsn: number;
  commonNames: string[];
  scientificName: string;
  rank?: string;
  kingdom?: string;
}

export interface ITaxonomySearchResponse {
  searchResponse: ITaxon[];
}

export interface ITaxonomyListResponse {
  searchResponse: ITaxon[];
}
