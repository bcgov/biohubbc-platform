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

export type EmptyObject = Record<string, never>;

export interface ISpatialData {
  submission_spatial_component_ids: number[];
  dataset_id?: string;
  associated_taxa?: string;
  vernacular_name?: string;
  spatial_data: FeatureCollection | EmptyObject;
}

/**
 * An interface for Spatial Metadata. Type synonymous with `GeoJsonProperties`.
 */
export type ISpatialMetadata = Record<string, any>;

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
