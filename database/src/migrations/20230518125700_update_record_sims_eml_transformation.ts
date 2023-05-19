import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;
const DB_SCHEMA_DAPI_V1 = process.env.DB_SCHEMA_DAPI_V1;

/**
 * EML source Transform.
 *
 * Generates a JSON object containing key information from an EML file.
 *
 * Note: The intention of this transform is to only parse data that is relevant to supporting search. Fields that are
 * not used in searching should not be included.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  const transformSQL = `
    WITH submissionmetadata AS (
      SELECT
        *
      FROM
        submission_metadata
      WHERE
        submission_id = ?
        AND record_end_timestamp IS NULL
    ),
    eml AS (
      SELECT
        Jsonb_path_query(eml_json_source, '$."eml:eml"') eml
      FROM
        submissionmetadata
    ),
    datasets AS (
      SELECT
        Jsonb_path_query(eml, '$.**.dataset') dataset
      FROM
        eml
    ),
    projects AS (
      SELECT
        p.proj_n,
        p.project
      FROM
        datasets,
        Jsonb_path_query_first(dataset, '$.**.project') WITH ordinality p(project, proj_n)
    ),
    related_projects AS (
      SELECT
        p.proj_n,
        p.project
      FROM
        datasets,
        jsonb_path_query_first(dataset, '$.**.relatedProject[*]') WITH ordinality p(project, proj_n)
    ),
    projects_funding AS (
      SELECT
        p.proj_n,
        pf.fund_n,
        pf.funding
      FROM
        projects p,
        jsonb_path_query_first(project, '$.funding.section') WITH ordinality pf(funding, fund_n)
    ),
    related_projects_funding AS (
      SELECT
        p.proj_n,
        pf.fund_n,
        pf.funding
      FROM
        related_projects p,
        jsonb_path_query_first(project, '$.funding.section') WITH ordinality pf(funding, fund_n)
    ),
    projects_fundings AS (
      SELECT
        pf.proj_n,
        pf.fund_n,
        pfs.funds_n,
        jsonb_build_object(
          'agencyName',
          pfs.projects_fundings -> 'para',
          'fundingStartDate',
          jsonb_path_query_first(
            pfs.projects_fundings,
            '$.section[*] \\? (@.title == "Funding Start Date").para'
          ),
          'fundingEndDate',
          jsonb_path_query_first(
            pfs.projects_fundings,
            '$.section[*] \\? (@.title == "Funding End Date").para'
          )
        ) funding_object
      FROM
        projects_funding pf,
        jsonb_array_elements(funding) WITH ordinality pfs(projects_fundings, funds_n)
    ),
    related_projects_fundings AS (
      SELECT
        pf.proj_n,
        pf.fund_n,
        pfs.funds_n,
        jsonb_build_object(
          'agencyName',
          pfs.related_projects_fundings -> 'para',
          'fundingStartDate',
          jsonb_path_query_first(
            pfs.related_projects_fundings,
            '$.section[*] \\? (@.title == "Funding Start Date").para'
          ),
          'fundingEndDate',
          jsonb_path_query_first(
            pfs.related_projects_fundings,
            '$.section[*] \\? (@.title == "Funding End Date").para'
          )
        ) funding_object
      FROM
        related_projects_funding pf,
        jsonb_array_elements(funding) WITH ordinality pfs(related_projects_fundings, funds_n)
    ),
    projects_funding_arrs AS (
      SELECT
        proj_n,
        jsonb_agg(funding_object) funding_arr
      FROM
        projects_fundings
      GROUP BY
        proj_n
    ),
    related_projects_funding_arrs AS (
      SELECT
        proj_n,
        jsonb_agg(funding_object) funding_arr
      FROM
        related_projects_fundings
      GROUP BY
        proj_n
    ),
    project_objects AS (
      SELECT
        jsonb_build_object(
          'projectId',
          aps.project -> '@_id',
          'projectTitle',
          aps.project -> 'title',
          'projectOrganizationName',
          aps.project -> 'personnel' -> 'organizationName',
          'projectAbstract',
          jsonb_path_query_first(aps.project, '$.abstract.section'),
          'taxonomicCoverage',
          jsonb_path_query_first(
            aps.project,
            '$.studyAreaDescription.coverage.taxonomicCoverage'
          ),
          'fundingSource',
          pfas.funding_arr
        ) project_object
      FROM
        projects aps
        LEFT JOIN projects_funding_arrs pfas ON pfas.proj_n = aps.proj_n
    ),
    related_project_objects AS (
      SELECT
        jsonb_build_object(
          'projectId',
          aps.project -> '@_id',
          'projectTitle',
          aps.project -> 'title',
          'projectOrganizationName',
          aps.project -> 'personnel' -> 'organizationName',
          'projectAbstract',
          jsonb_path_query_first(aps.project, '$.abstract.section'),
          'taxonomicCoverage',
          jsonb_path_query_first(
            aps.project,
            '$.studyAreaDescription.coverage.taxonomicCoverage'
          ),
          'fundingSource',
          pfas.funding_arr
        ) project_object
      FROM
        related_projects aps
        LEFT JOIN related_projects_funding_arrs pfas ON pfas.proj_n = aps.proj_n
    ),
    project_objects_arr AS (
      SELECT
        jsonb_agg(project_object) project_objects_arr
      FROM
        project_objects
    ),
    related_project_objects_arr AS (
      SELECT
        jsonb_agg(project_object) project_objects_arr
      FROM
        related_project_objects
    ),
    project_type AS (
      select * from (
        select s.uuid, sm.submission_id, data_array -> 'metadata' -> 'types' ->> 'type' as dataset_type
        from
          submission s, 
          submission_metadata sm,
          json_array_elements(sm.eml_json_source::json->'eml:eml'->'additionalMetadata') as data_array
        where s.submission_id = sm.submission_id 
        and sm.record_end_timestamp is null
        and uuid(data_array ->> 'describes') = s.uuid
        order by s.uuid
      ) as submission_type
      where submission_type.dataset_type is not null
      and submission_type.uuid = d.dataset ->> '@_id';
    )
    SELECT
      jsonb_strip_nulls(
        jsonb_build_object(
          'datasetTitle',
          d.dataset -> 'title',
          'datasetId',
          d.dataset -> '@_id',
          'sourceSystem',
          d.dataset -> '@_system',
          'publishDate',
          d.dataset -> 'pubDate',
          'project',
          poa.project_objects_arr,
          'relatedProject',
          rpoa.project_objects_arr,
          'submitterSystem',
          'sims',
          'primaryKeywords',
          '',
          'additionalMetadata',
          jsonb_build_object(
            'projectIUCNConservationActions',
            jsonb_path_query_first(
              e.eml,
              '$.additionalMetadata[*].metadata.IUCNConservationActions.IUCNConservationAction'
            ),
            'projectStakeholderPartnerships',
            jsonb_path_query_first(
              e.eml,
              '$.additionalMetadata[*].metadata.stakeholderPartnerships.stakeholderPartnership'
            ),
            'projectActivities',
            jsonb_path_query_first(
              e.eml,
              '$.additionalMetadata[*].metadata.projectActivities.projectActivity'
            ),
            'projectFirstNations',
            jsonb_path_query_first(
              e.eml,
              '$.additionalMetadata[*].metadata.firstNationPartnerships.firstNationPartnership'
            ),
            'projectSurveyProprietors',
            jsonb_path_query_first(
              e.eml,
              '$.additionalMetadata[*].metadata.projectSurveyProprietors.projectSurveyProprietor'
            )
          )
        )
      ) result_data
    FROM
      eml e,
      datasets d,
      project_objects_arr poa,
      related_project_objects_arr rpoa;
  `;
  await knex.raw(`
    SET SCHEMA '${DB_SCHEMA}';
    SET SEARCH_PATH = ${DB_SCHEMA}, ${DB_SCHEMA_DAPI_V1};

    update source_transform
    set version='1.1', metadata_transform=$transform$${transformSQL}$transform$
    where system_user_id = (select system_user_id from system_user where user_identifier = 'service-account-SIMS-SVC-4464');
  `);
}

/**
 * Not used.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
