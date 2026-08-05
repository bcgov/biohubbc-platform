import { MaterializedViewColumn } from '../types';

export const TELEMETRY_COLUMNS: MaterializedViewColumn[] = [
  { alias: 'Feature_ID', expression: 'sf.submission_feature_id' },
  { alias: 'taxon_id', expression: 'ra.taxon_id::int' },
  { alias: 'scientific_name', expression: 't.itis_scientific_name' },
  { alias: 'common_name', expression: 't.common_name' },
  { alias: 'animal_id', expression: 'd.animal_id' },
  { alias: 'sex', expression: 'ra.sex' },
  { alias: 'eco_unit', expression: 'reu.ecological_unit' },
  { alias: 'device_key', expression: 'd.device_key' },
  { alias: 'date', expression: "((sf.data#>>'{properties,timestamp}')::timestamptz)::date" },
  { alias: 'time', expression: "((sf.data#>>'{properties,timestamp}')::timestamptz)::time" },
  { alias: 'YEAR', expression: "EXTRACT(YEAR FROM (sf.data#>>'{properties,timestamp}')::timestamptz)::int" },
  { alias: 'Latitude', expression: 'public.ST_Y(tl.geometry)' },
  { alias: 'Longitude', expression: 'public.ST_X(tl.geometry)' },
  { alias: 'dop', expression: "(sf.data#>>'{properties,dop}')::numeric" },
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
  { alias: 'Feature_ID', expression: 'sf.submission_feature_id' },
  { alias: 'taxon_id', expression: "(sf.data#>>'{properties,taxon_id}')::int" },
  { alias: 'scientific_name', expression: 't.itis_scientific_name' },
  { alias: 'common_name', expression: 't.common_name' },
  { alias: 'sign', expression: "(sf.data#>>'{properties,sign}')::text" },
  {
    alias: 'group_id',
    expression:
      "CASE WHEN NULLIF(sf.data#>>'{properties,observation_id}', '') IS NULL THEN NULL ELSE sub.contributor_client_id || '::' || (sf.data#>>'{properties,observation_id}') END"
  },
  { alias: 'sex', expression: "COALESCE(ccc_sex.label, (sf.data#>>'{properties,sex}')::text)" },
  {
    alias: 'life_stage',
    expression: "COALESCE(ccc_life_stage.label, (sf.data#>>'{properties,life_stage}')::text)"
  },
  {
    alias: 'count',
    expression: "COALESCE((sf.data#>>'{properties,subcount_count}')::int, (sf.data#>>'{properties,count}')::int)"
  },
  {
    alias: 'date',
    expression:
      "(CASE WHEN NULLIF(sf.data#>>'{properties,timestamp}', '') IS NULL THEN spst.start_timestamp ELSE (sf.data#>>'{properties,timestamp}')::timestamptz END)::date"
  },
  {
    alias: 'time',
    expression:
      "(CASE WHEN NULLIF(sf.data#>>'{properties,timestamp}', '') IS NULL THEN spst.start_timestamp ELSE (sf.data#>>'{properties,timestamp}')::timestamptz END)::time"
  },
  {
    alias: 'YEAR',
    expression:
      "EXTRACT(YEAR FROM (CASE WHEN NULLIF(sf.data#>>'{properties,timestamp}', '') IS NULL THEN spst.start_timestamp ELSE (sf.data#>>'{properties,timestamp}')::timestamptz END))::int"
  },
  { alias: 'Latitude', expression: 'public.ST_Y(ol.location_point)' },
  { alias: 'Longitude', expression: 'public.ST_X(ol.location_point)' },
  { alias: 'submission_id', expression: 'sub.submission_id' },
  { alias: 'submission_name', expression: 'sub.submission_name' },
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
