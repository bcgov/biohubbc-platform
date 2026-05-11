import { MaterializedViewColumn } from '../types';

export const TELEMETRY_COLUMNS: MaterializedViewColumn[] = [
  { alias: 'Feature_ID', expression: 'sf.submission_feature_id' },
  { alias: 'common_name', expression: 't.common_name' },
  { alias: 'scientific_name', expression: 't.itis_scientific_name' },
  { alias: 'animal_id', expression: 'd.animal_id' },
  { alias: 'sex', expression: 'ra.sex' },
  { alias: 'pop_unit', expression: 'reu.ecological_unit_value' },
  { alias: 'device_key', expression: 'd.device_key' },
  { alias: 'DATETIME', expression: "(sf.data->>'timestamp')::timestamptz" },
  { alias: 'YEAR', expression: "EXTRACT(YEAR FROM (sf.data->>'timestamp')::timestamptz)::int" },
  { alias: 'Latitude', expression: "(sf.data->>'latitude')::numeric" },
  { alias: 'Longitude', expression: "(sf.data->>'longitude')::numeric" },
  { alias: 'dop', expression: "(sf.data->>'dop')::numeric" },
  { alias: 'dataset_id', expression: 'ds.dataset_id' },
  { alias: 'dataset_name', expression: 'ds.dataset_name' },
  {
    alias: 'SECURED',
    expression:
      "CASE WHEN EXISTS (SELECT 1 FROM biohub.submission_feature_security sfs WHERE sfs.submission_feature_id = sf.submission_feature_id) THEN 'Y' ELSE 'N' END"
  }
];

export const OBSERVATIONS_COLUMNS: MaterializedViewColumn[] = [
  { alias: 'observation_id', expression: 'COALESCE(parent_obs.parent_observation_id, sf.submission_feature_id)' },
  { alias: 'observation_subcount_id', expression: 'parent_obs.subcount_id' },
  { alias: 'Feature_ID', expression: 'COALESCE(sf_subcount.submission_feature_id, sf.submission_feature_id)' },
  { alias: 'DATETIME', expression: "(sf.data->>'timestamp')::timestamptz" },
  { alias: 'YEAR', expression: "(EXTRACT(YEAR FROM (sf.data->>'timestamp')::timestamptz))::int" },
  { alias: 'Latitude', expression: "public.ST_Y(public.ST_GeomFromGeoJSON(sf.data->>'geometry'))" },
  { alias: 'Longitude', expression: "public.ST_X(public.ST_GeomFromGeoJSON(sf.data->>'geometry'))" },
  { alias: 'sign', expression: "(sf.data->>'sign')::text" },
  { alias: 'count', expression: "COALESCE((sf_subcount.data->>'subcount_count')::int, (sf.data->>'count')::int)" },
  { alias: 'taxon_id', expression: "(sf.data->>'taxon_id')::int" },
  { alias: 'scientific_name', expression: 't.itis_scientific_name' },
  { alias: 'common_name', expression: 't.common_name' },
  { alias: 'dataset_id', expression: 'od.dataset_id' },
  { alias: 'dataset_name', expression: 'od.dataset_name' },
  { alias: 'sex', expression: "COALESCE(ccc_sex.label, (COALESCE(sf_subcount.data->>'sex', sf.data->>'sex'))::text)" },
  {
    alias: 'life_stage',
    expression:
      "COALESCE(ccc_life_stage.label, (COALESCE(sf_subcount.data->>'life_stage', sf.data->>'life_stage'))::text)"
  },
  {
    alias: 'SECURED',
    expression:
      "CASE WHEN EXISTS (SELECT 1 FROM biohub.submission_feature_security sfs WHERE sfs.submission_feature_id = sf.submission_feature_id) THEN 'Y' ELSE 'N' END"
  }
];
