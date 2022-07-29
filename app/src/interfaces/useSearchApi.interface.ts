import { Feature, FeatureCollection } from 'geojson';

/**
 * Get search results response object.
 *
 * @export
 * @interface IGetSearchResultsResponse
 */
export interface IGetSearchResultsResponse {
  id: string;
  name?: string;
  objectives?: string;
  associatedtaxa?: string;
  lifestage?: string;
  geometry: Feature[];
}

export type IGetSpatialDataResponse = {
  submission_spatial_component_id: number;
  spatial_data: FeatureCollection;
};

/**
 * An interface for an instance of filter fields for search results
 */
export interface ISearchResultsAdvancedFilterRequest {
  record_type: string;
  geometry: Feature[];
}

/**
 * Interface for Occurrence table return.
 * Check api\src\repositories\occurrence-repository.ts for updates
 * @export
 * @interface IGetOccurrenceData
 */
export interface IGetOccurrenceData {
  occurrenceId: number;
  submissionId: number;
  taxonId: string | null;
  lifeStage: string | null;
  sex: string | null;
  eventDate: object | null;
  vernacularName: string | null;
  individualCount: number | null;
  organismQuantity: number | null;
  organismQuantityType: string | null;
  geometry: Feature | null;
}

export type IElasticsearchResponse<T = unknown, S = unknown> = {
  id: string;
  fields: T;
  source: S;
}[];

export interface IKeywordSearchResult {
  //TODO: incorporate Promise<IElasticsearchResponse<unknown, IKeywordSearchResult>>  into the interface
  id: string;
  source: Record<string, any>;
  fields: Record<string, any>;
  observation_count: number;
}

export interface IAdvancedSearch {
  keywords: string;
}
