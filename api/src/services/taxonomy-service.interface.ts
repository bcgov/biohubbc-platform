export type TaxonSearchResult = {
  tsn: number;
  commonNames: string[];
  scientificName: string;
};

export type TaxonRepairPlan = {
  hierarchyTsnIds: number[];
  incompleteRankTsnIds: number[];
};
