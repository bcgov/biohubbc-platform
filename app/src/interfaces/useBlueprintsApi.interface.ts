import { ApiPaginationResponseParams } from 'types/pagination';

export interface IBlueprint {
  blueprint_id: number;
  name: string;
  version_number: number;
  description: string | null;
  is_default: boolean;
  parent_blueprint_id: number | null;
  record_effective_date: string | null;
  record_end_date: string | null;
}
export interface IBlueprintsResponse {
  blueprints: IBlueprint[];
  pagination: ApiPaginationResponseParams;
}
export interface ICreateBlueprint {
  name: string;
  description: string | null;
  parentBlueprintId: number | null;
  recordEffectiveDate?: string | null;
}
export interface IUpdateBlueprint {
  name?: string;
  description?: string | null;
  parentBlueprintId?: number | null;
  recordEffectiveDate?: string | null;
}
export interface IBlueprintFilters {
  keyword?: string;
}
