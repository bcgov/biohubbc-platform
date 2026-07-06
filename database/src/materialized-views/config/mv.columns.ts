import { MaterializedViewColumn } from '../types';

export const TELEMETRY_COLUMNS: MaterializedViewColumn[] = [
  { alias: 'Feature_ID', expression: 'sf.submission_feature_id' },
  { alias: 'common_name', expression: 't.common_name' },
  { alias: 'scientific_name', expression: 't.itis_scientific_name' },
  { alias: 'animal_id', expression: 'd.animal_id' },
  { alias: 'sex', expression: 'ra.sex' },
  { alias: 'pop_unit', expression: 'reu.ecological_unit_value' },
  { alias: 'device_key', expression: 'd.device_key' },
  { alias: 'date', expression: "((sf.data->>'timestamp')::timestamptz)::date" },
  { alias: 'time', expression: "((sf.data->>'timestamp')::timestamptz)::time" },
  { alias: 'YEAR', expression: "EXTRACT(YEAR FROM (sf.data->>'timestamp')::timestamptz)::int" },
  { alias: 'Latitude', expression: "(sf.data->>'latitude')::numeric" },
  { alias: 'Longitude', expression: "(sf.data->>'longitude')::numeric" },
  { alias: 'dop', expression: "(sf.data->>'dop')::numeric" },
  { alias: 'submission_id', expression: 's.submission_id' },
  { alias: 'submission_name', expression: 's.submission_name' },
  {
    alias: 'SECURED',
    expression:
      "CASE WHEN EXISTS (SELECT 1 FROM biohub.submission_feature_security sfs WHERE sfs.submission_feature_id = sf.submission_feature_id) THEN 'Y' ELSE 'N' END"
  },
  {
    alias: 'source',
    expression:
      "'https://biodiversityhub.gov.bc.ca/submission/' || sf.submission_id || '/feature/' || sf.submission_feature_id"
  }
];

export const OBSERVATIONS_COLUMNS: MaterializedViewColumn[] = [
  {
    alias: 'group_id',
    expression:
      "CASE WHEN NULLIF(sf.data->>'observation_id', '') IS NULL THEN NULL ELSE sub.contributor_client_id || '::' || (sf.data->>'observation_id') END"
  },
  { alias: 'Feature_ID', expression: 'sf.submission_feature_id' },
  {
    alias: 'date',
    expression:
      "(CASE WHEN NULLIF(sf.data->>'timestamp', '') IS NULL THEN spst.start_timestamp ELSE (sf.data->>'timestamp')::timestamptz END)::date"
  },
  {
    alias: 'time',
    expression:
      "(CASE WHEN NULLIF(sf.data->>'timestamp', '') IS NULL THEN spst.start_timestamp ELSE (sf.data->>'timestamp')::timestamptz END)::time"
  },
  {
    alias: 'YEAR',
    expression:
      "EXTRACT(YEAR FROM (CASE WHEN NULLIF(sf.data->>'timestamp', '') IS NULL THEN spst.start_timestamp ELSE (sf.data->>'timestamp')::timestamptz END))::int"
  },
  { alias: 'Latitude', expression: 'public.ST_Y(ol.location_point)' },
  { alias: 'Longitude', expression: 'public.ST_X(ol.location_point)' },
  { alias: 'sign', expression: "(sf.data->>'sign')::text" },
  { alias: 'count', expression: "COALESCE((sf.data->>'subcount_count')::int, (sf.data->>'count')::int)" },
  { alias: 'taxon_id', expression: "(sf.data->>'taxon_id')::int" },
  { alias: 'scientific_name', expression: 't.itis_scientific_name' },
  { alias: 'common_name', expression: 't.common_name' },
  { alias: 'submission_id', expression: 'sub.submission_id' },
  { alias: 'submission_name', expression: 'sub.submission_name' },
  { alias: 'sex', expression: "COALESCE(ccc_sex.label, (sf.data->>'sex')::text)" },
  {
    alias: 'life_stage',
    expression: "COALESCE(ccc_life_stage.label, (sf.data->>'life_stage')::text)"
  },
  {
    alias: 'SECURED',
    expression:
      "CASE WHEN EXISTS (SELECT 1 FROM biohub.submission_feature_security sfs WHERE sfs.submission_feature_id = sf.submission_feature_id) THEN 'Y' ELSE 'N' END"
  },
  {
    alias: 'source',
    expression:
      "'https://biodiversityhub.gov.bc.ca/submission/' || sf.submission_id || '/feature/' || sf.submission_feature_id"
  }
];
