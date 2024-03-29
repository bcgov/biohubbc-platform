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
  taxonID?: string;
  lifestage?: string;
  geometry: Feature[];
}

export type EmptyObject = Record<string, never>;

export interface ITaxaData {
  taxon_id?: string;
  vernacular_name?: string;
  submission_spatial_component_id: number;
}
export interface ISpatialData {
  taxa_data: ITaxaData[];
  spatial_data: FeatureCollection | EmptyObject;
}

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

export type IElasticSearchResponse<Fields = unknown, Source = unknown> = {
  id: string;
  fields: Fields;
  source: Source;
};

export interface IKeywordSearchResponse<Fields = Record<string, any>, Source = Record<string, any>>
  extends IElasticSearchResponse<Fields, Source> {
  observation_count: number;
}

export interface IAdvancedSearch {
  keywords: string;
}
