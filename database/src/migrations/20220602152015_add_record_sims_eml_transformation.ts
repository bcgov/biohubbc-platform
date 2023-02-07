import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;
const DB_SCHEMA_DAPI_V1 = process.env.DB_SCHEMA_DAPI_V1;

/**
 * Add source_transform to parse EML json data into the json version expected elastic search.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SCHEMA '${DB_SCHEMA}';
    SET SEARCH_PATH = ${DB_SCHEMA}, ${DB_SCHEMA_DAPI_V1};

    insert into source_transform (system_user_id, version, metadata_index, metadata_transform)
		values ((select system_user_id from system_user where user_identifier = 'service-account-SIMS-SVC-4464'), '1.0', 'biohub_metadata', $transform$with submission_metadata as (select * from submission_metadata where submission_id = ?)
    , eml as (select jsonb_path_query(eml_json_source, '$."eml:eml"') eml from submission_metadata)
    , datasets as (select jsonb_path_query(eml, '$.**.dataset') dataset from eml)
    , projects as (select p.proj_n, 'project' project_type, p.project from datasets, jsonb_path_query_first(dataset, '$.**.project') with ordinality p(project, proj_n))
    , related_projects as (select p.proj_n, 'survey' project_type, p.project from datasets, jsonb_path_query_first(dataset, '$.**.relatedProject[*]') with ordinality p(project, proj_n))
    , all_projects as (select * from projects union select * from related_projects)
    , funding as (select ap.proj_n, ap.project_type, f.fund_n, f.funding from all_projects ap, jsonb_path_query_first(project, '$.funding.section') with ordinality f(funding, fund_n))
    , fundings as (select f.proj_n, f.project_type, f.fund_n, fs.funds_n, jsonb_build_object('agencyName', fs.fundings->'para', 'fundingStartDate', jsonb_path_query_first(fs.fundings, '$.section[*] \\? (@.title == "Funding Start Date").para'), 'fundingEndDate', jsonb_path_query_first(fs.fundings, '$.section[*] \\? (@.title == "Funding End Date").para')) funding_object from funding f, jsonb_array_elements(funding) with ordinality fs(fundings, funds_n))
    , funding_arrs as (select proj_n, project_type, jsonb_agg(funding_object) funding_arr from fundings group by project_type, proj_n)
    , project_objects as (select jsonb_build_object('projectId', aps.project->'@_id'
      , 'projectType', aps.project_type
      , 'projectTitle', aps.project->'title'
      , 'projectOrganizationName', aps.project->'personnel'->'organizationName'
      , 'projectAbstract', jsonb_path_query_first(aps.project, '$.abstract.section')
      , 'taxonomicCoverage', jsonb_path_query_first(aps.project, '$.studyAreaDescription.coverage.taxonomicCoverage')
      , 'fundingSource', fas.funding_arr
		) project_object from all_projects aps
      	left join funding_arrs fas on fas.proj_n = aps.proj_n and fas.project_type = aps.project_type
     	)
    , project_arr as (select jsonb_agg(project_object) project_array from project_objects)
    select jsonb_strip_nulls(jsonb_build_object('datasetTitle', d.dataset->'title'
      , 'datasetId', d.dataset->'@_id'
      , 'sourceSystem', d.dataset->'@_system'
      , 'publishDate', d.dataset->'pubDate'
      , 'project', p.project_array
      , 'projectIUCNConservationActions', jsonb_path_query_first(e.eml, '$.additionalMetadata[*].metadata.IUCNConservationActions.IUCNConservationAction')
      , 'projectStakeholderPartnerships', jsonb_path_query_first(e.eml, '$.additionalMetadata[*].metadata.stakeholderPartnerships.stakeholderPartnership')
      , 'projectActivities', jsonb_path_query_first(e.eml, '$.additionalMetadata[*].metadata.projectActivities.projectActivity')
      , 'projectClimateChangeInitiatives', jsonb_path_query_first(e.eml, '$.additionalMetadata[*].metadata.projectClimateChangeInitiatives.projectClimateChangeInitiative')
      , 'projectFirstNations', jsonb_path_query_first(e.eml, '$.additionalMetadata[*].metadata.firstNationPartnerships.firstNationPartnership')
      , 'projectSurveyProprietors', jsonb_path_query_first(e.eml, '$.additionalMetadata[*].metadata.projectSurveyProprietors.projectSurveyProprietor')
      )) result_data from eml e, datasets d, project_arr p;$transform$);

  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
