-- run as db super user
-- smoketest_release.sql
\c biohub
set role postgres;
set search_path=biohub;

do $$
declare
  _count integer = 0;
  _system_user system_user%rowtype;
  _system_user_id system_user.system_user_id%type;
begin
  select * into _system_user from system_user where user_guid = 'myIDIR';
  if _system_user.system_user_id is not null then
    delete from system_user_role where system_user_id = _system_user.system_user_id;
    delete from system_user where system_user_id = _system_user.system_user_id;
  end if;

  insert into system_user (user_identity_source_id, user_guid, user_identifier, record_effective_date) values ((select user_identity_source_id from user_identity_source where name = 'IDIR' and record_end_date is null), 'myIDIR', 'myIDIR',now()) returning system_user_id into _system_user_id;
  insert into system_user_role (system_user_id, system_role_id) values (_system_user_id, (select system_role_id from system_role where name =  'System Administrator'));

  select count(1) into _count from system_user;
  assert _count > 1, 'FAIL system_user';
  select count(1) into _count from audit_log;
  assert _count > 1, 'FAIL audit_log';

  -- drop security context for subsequent roles to instantiate
  drop table biohub_context_temp;

  raise notice 'smoketest_release(1): PASS';
end
$$;

set role biohub_api;
set search_path to biohub_dapi_v1, biohub, public, topology;
do $$
declare
  _count integer = 0;
  _system_user_id system_user.system_user_id%type;
  _submission_id submission.submission_id%type;
	_submission_observation_id submission_observation.submission_observation_id%type;
  _submission_status_id submission_status.submission_status_id%type;
  _geography submission_spatial_component.geography%type;
  _source_transform_id source_transform.source_transform_id%type;
  _eml_source submission_metadata.eml_source%type = '<?xml version="1.0" encoding="UTF-8"?>
<eml:eml packageId="urn:uuid:cad7c99c-a1e7-442c-9239-1db953c83a87" system="https://biohub.gov.bc.ca"
	xmlns:eml="https://eml.ecoinformatics.org/eml-2.2.0"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xmlns:stmml="http://www.xml-cml.org/schema/stmml-1.1"
	xsi:schemaLocation="https://eml.ecoinformatics.org/eml-2.2.0 xsd/eml.xsd">
	<access authSystem="https://biohub.bc.ca" order="allowFirst">
		<allow>
			<principal>public</principal>
			<permission>read</permission>
		</allow>
	</access>
	<dataset id="cad7c99c-a1e7-442c-9239-1db953c83a87" system="https://biohub.gov.bc.ca">
		<title>Coastal Caribou</title>
		<creator>
			<organizationName>Knowledge Management Branch, Ministry of Water, Land and Natural Resources, Government of British Columbia</organizationName>
		</creator>
		<metadataProvider>
			<organizationName>Knowledge Management Branch, Ministry of Water, Land and Natural Resources, Government of British Columbia</organizationName>
			<onlineUrl>https://www2.gov.bc.ca/gov/content/governments/organizational-structure/ministries-organizations/ministries/water-land-and-resource-stewardship</onlineUrl>
		</metadataProvider>
		<pubDate>2021-08-05</pubDate>
		<language>english</language>
		<intellectualRights>
			<para>Intellectual rights example.</para>
		</intellectualRights>
		<contact>
			<individualName>
				<givenName>coordinator_first_name</givenName>
				<surName>coordinator_last_name</surName>
			</individualName>
			<organizationName>coordinator_agency_name</organizationName>
			<electronicMailAddress>coordinator_email_address@nowhere.com</electronicMailAddress>
		</contact>
		<project id="78ba2b5d-252b-46dc-909f-e634aa26a402" system="https://biohub.gov.bc.ca">
			<title>West Coast</title>
			<personnel>
				<individualName>
					<givenName>lead first</givenName>
					<surName>lead last</surName>
				</individualName>
				<organizationName>Acme Bio Consulting Ltd.</organizationName>
				<role>pointOfContact</role>
			</personnel>
			<abstract>
				<section>
					<title>Objectives</title>
					<para>The new Common Terms Query is designed to fix this situations, and it does so through a very clever mechanism. At a high level, Common Terms analyzes your query, identifies which words are important and performs a search using just those words. Only after documents are matched with important words are the unimportant words considered.</para>
				</section>
			</abstract>
			<funding>
				<section>
					<title>Funding Source</title>
					<para>Together for Wildlife</para>
					<section>
						<title>Investment Action Category</title>
						<para>Action 1</para>
						<section>
							<title>Funding Source Project ID</title>
							<para>1</para>
						</section>
						<section>
							<title>Funding Amount</title>
							<para>$1,000.00</para>
						</section>
						<section>
							<title>Funding Start Date</title>
							<para>2021-08-06</para>
						</section>
						<section>
							<title>Funding End Date</title>
							<para>2021-10-06</para>
						</section>
					</section>
				</section>
			</funding>
			<studyAreaDescription>
				<coverage>
					<geographicCoverage>
						<geographicDescription>survey location name - survey location description</geographicDescription>
						<boundingCoordinates>
							<westBoundingCoordinate>-123.940887</westBoundingCoordinate>
							<eastBoundingCoordinate>-123.539886</eastBoundingCoordinate>
							<northBoundingCoordinate>48.645205</northBoundingCoordinate>
							<southBoundingCoordinate>48.460674</southBoundingCoordinate>
						</boundingCoordinates>
						<datasetGPolygon>
							<datasetGPolygonOuterGRing>
								<gRingPoint>
									<gRingLatitude>48.592142</gRingLatitude>
									<gRingLongitude>-123.920288</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>48.645205</gRingLatitude>
									<gRingLongitude>-123.667603</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>48.536204</gRingLatitude>
									<gRingLongitude>-123.539886</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>48.46978</gRingLatitude>
									<gRingLongitude>-123.583832</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>48.460674</gRingLatitude>
									<gRingLongitude>-123.728027</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>48.467959</gRingLatitude>
									<gRingLongitude>-123.868103</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>48.5262</gRingLatitude>
									<gRingLongitude>-123.940887</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>48.592142</gRingLatitude>
									<gRingLongitude>-123.920288</gRingLongitude>
								</gRingPoint>
							</datasetGPolygonOuterGRing>
						</datasetGPolygon>
						<datasetGPolygon>
							<datasetGPolygonOuterGRing>
								<gRingPoint>
									<gRingLatitude>38.592142</gRingLatitude>
									<gRingLongitude>-103.920288</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>38.645205</gRingLatitude>
									<gRingLongitude>-103.667603</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>38.536204</gRingLatitude>
									<gRingLongitude>-103.539886</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>38.46978</gRingLatitude>
									<gRingLongitude>-103.583832</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>38.460674</gRingLatitude>
									<gRingLongitude>-103.728027</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>38.467959</gRingLatitude>
									<gRingLongitude>-103.868103</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>38.5262</gRingLatitude>
									<gRingLongitude>-103.940887</gRingLongitude>
								</gRingPoint>
								<gRingPoint>
									<gRingLatitude>38.592142</gRingLatitude>
									<gRingLongitude>-103.920288</gRingLongitude>
								</gRingPoint>
							</datasetGPolygonOuterGRing>
						</datasetGPolygon>
					</geographicCoverage>
					<temporalCoverage>
						<rangeOfDates>
							<beginDate>
								<calendarDate>2021-08-06</calendarDate>
							</beginDate>
							<endDate>
								<calendarDate>2021-08-07</calendarDate>
							</endDate>
						</rangeOfDates>
					</temporalCoverage>
					<taxonomicCoverage>
						<taxonomicClassification>
							<taxonRankName>SPECIES</taxonRankName>
							<taxonRankValue>Amaranthus albus</taxonRankValue>
							<commonName>Tumbleweed</commonName>
							<taxonId provider="https://biohub.bc.ca">AMARALB</taxonId>
						</taxonomicClassification>
					</taxonomicCoverage>
				</coverage>
			</studyAreaDescription>
			<relatedProject id="d26547a9-31f3-4477-9ca4-e8a8e7edc237" system="https://biohub.gov.bc.ca">
				<title>North West Coast</title>
				<personnel>
					<individualName>
						<givenName>coordinator_first_name</givenName>
						<surName>coordinator_last_name</surName>
					</individualName>
					<organizationName>Fish Looking Company</organizationName>
					<electronicMailAddress>coordinator_email_address@nowhere.com</electronicMailAddress>
					<role>pointOfContact</role>
				</personnel>
				<abstract>
					<section>
						<title>Objectives</title>
						<para>With traditional stop word schemes, you must first create a list of stop words. Every domain is unique when it comes to stop words: there are no pre-made stop word lists on the internet. As an example, consider the word video. For most businesses, video is an important word – it shouldn''t be removed. But if you are Youtube, video is probably mentioned in thousands of places…it is definitely a stop word in this context. Traditional stop word removal would need a human to sit down, compile a list of domain-specific stop words, add it to Elasticsearch and then routinely maintain the list with additions/deletions.</para>
					</section>
					<section>
						<title>Caveates</title>
						<para/>
					</section>
					<section>
						<title>Comments</title>
						<para/>
					</section>
				</abstract>
				<funding>
					<section>
						<title>Funding Source</title>
						<para>Together for Wildlife</para>
						<section>
							<title>Investment Action Category</title>
							<para>Action 1</para>
							<section>
								<title>Funding Source Project ID</title>
								<para>1</para>
							</section>
							<section>
								<title>Funding Amount</title>
								<para>$1,000.00</para>
							</section>
							<section>
								<title>Funding Start Date</title>
								<para>2021-08-06</para>
							</section>
							<section>
								<title>Funding End Date</title>
								<para>2022-01-09</para>
							</section>
						</section>
					</section>
				</funding>
				<studyAreaDescription>
					<coverage>
						<geographicCoverage>
							<geographicDescription>Not provided</geographicDescription>
							<boundingCoordinates>
								<westBoundingCoordinate>-123.940887</westBoundingCoordinate>
								<eastBoundingCoordinate>-123.539886</eastBoundingCoordinate>
								<northBoundingCoordinate>48.645205</northBoundingCoordinate>
								<southBoundingCoordinate>48.460674</southBoundingCoordinate>
							</boundingCoordinates>
							<datasetGPolygon>
								<datasetGPolygonOuterGRing>
									<gRingPoint>
										<gRingLatitude>48.592142</gRingLatitude>
										<gRingLongitude>-123.920288</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.645205</gRingLatitude>
										<gRingLongitude>-123.667603</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.536204</gRingLatitude>
										<gRingLongitude>-123.539886</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.46978</gRingLatitude>
										<gRingLongitude>-123.583832</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.460674</gRingLatitude>
										<gRingLongitude>-123.728027</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.467959</gRingLatitude>
										<gRingLongitude>-123.868103</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.5262</gRingLatitude>
										<gRingLongitude>-123.940887</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.592142</gRingLatitude>
										<gRingLongitude>-123.920288</gRingLongitude>
									</gRingPoint>
								</datasetGPolygonOuterGRing>
							</datasetGPolygon>
							<datasetGPolygon>
								<datasetGPolygonOuterGRing>
									<gRingPoint>
										<gRingLatitude>38.592142</gRingLatitude>
										<gRingLongitude>-103.920288</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.645205</gRingLatitude>
										<gRingLongitude>-103.667603</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.536204</gRingLatitude>
										<gRingLongitude>-103.539886</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.46978</gRingLatitude>
										<gRingLongitude>-103.583832</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.460674</gRingLatitude>
										<gRingLongitude>-103.728027</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.467959</gRingLatitude>
										<gRingLongitude>-103.868103</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.5262</gRingLatitude>
										<gRingLongitude>-103.940887</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.592142</gRingLatitude>
										<gRingLongitude>-103.920288</gRingLongitude>
									</gRingPoint>
								</datasetGPolygonOuterGRing>
							</datasetGPolygon>
						</geographicCoverage>
						<temporalCoverage>
							<rangeOfDates>
								<beginDate>
									<calendarDate>2021-08-06</calendarDate>
								</beginDate>
								<endDate>
									<calendarDate>2021-08-07</calendarDate>
								</endDate>
							</rangeOfDates>
						</temporalCoverage>
					</coverage>
				</studyAreaDescription>
			</relatedProject>
			<relatedProject id="d26547a9-31f3-4477-9ca4-e8a8e7edc236" system="https://biohub.gov.bc.ca">
				<title>South West Coast</title>
				<personnel>
					<individualName>
						<givenName>coordinator_first_name</givenName>
						<surName>coordinator_last_name</surName>
					</individualName>
					<organizationName>AAA Biotic Corp.</organizationName>
					<electronicMailAddress>coordinator_email_address@nowhere.com</electronicMailAddress>
					<role>pointOfContact</role>
				</personnel>
				<abstract>
					<section>
						<title>Objectives</title>
						<para>To be, or not to be, that is the question: Whether tis nobler in the mind to suffer Or to take arms against a sea of troubles The slings and arrows of outrageous fortune, And by opposing end them. To die—to sleep, No more; and by a sleep to say we end The heart-ache and the thousand natural shocks That flesh is heir to: tis a consummation Devoutly to be wishd. To die, to sleep; To sleep, perchance to dream—ay, theres the rub: For in that sleep of death what dreams may come, When we have shuffled off this mortal coil, Must give us pause—theres the respect That makes calamity of so long life. For who would bear the whips and scorns of time, Thoppressors wrong, the proud mans contumely, The pangs of disprizd love, the laws delay, The insolence of office, and the spurns</para>
					</section>
					<section>
						<title>Caveates</title>
						<para/>
					</section>
					<section>
						<title>Comments</title>
						<para/>
					</section>
				</abstract>
				<funding>
					<section>
						<title>Funding Source</title>
						<para>BC Hydro</para>
						<section>
							<title>Investment Action Category</title>
							<para>Action 1</para>
							<section>
								<title>Funding Source Project ID</title>
								<para>1</para>
							</section>
							<section>
								<title>Funding Amount</title>
								<para>$1,000.00</para>
							</section>
							<section>
								<title>Funding Start Date</title>
								<para>2021-08-06</para>
							</section>
							<section>
								<title>Funding End Date</title>
								<para>2022-01-01</para>
							</section>
						</section>
					</section>
				</funding>
				<studyAreaDescription>
					<coverage>
						<geographicCoverage>
							<geographicDescription>Not provided</geographicDescription>
							<boundingCoordinates>
								<westBoundingCoordinate>-123.940887</westBoundingCoordinate>
								<eastBoundingCoordinate>-123.539886</eastBoundingCoordinate>
								<northBoundingCoordinate>48.645205</northBoundingCoordinate>
								<southBoundingCoordinate>48.460674</southBoundingCoordinate>
							</boundingCoordinates>
							<datasetGPolygon>
								<datasetGPolygonOuterGRing>
									<gRingPoint>
										<gRingLatitude>48.592142</gRingLatitude>
										<gRingLongitude>-123.920288</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.645205</gRingLatitude>
										<gRingLongitude>-123.667603</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.536204</gRingLatitude>
										<gRingLongitude>-123.539886</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.46978</gRingLatitude>
										<gRingLongitude>-123.583832</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.460674</gRingLatitude>
										<gRingLongitude>-123.728027</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.467959</gRingLatitude>
										<gRingLongitude>-123.868103</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.5262</gRingLatitude>
										<gRingLongitude>-123.940887</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>48.592142</gRingLatitude>
										<gRingLongitude>-123.920288</gRingLongitude>
									</gRingPoint>
								</datasetGPolygonOuterGRing>
							</datasetGPolygon>
							<datasetGPolygon>
								<datasetGPolygonOuterGRing>
									<gRingPoint>
										<gRingLatitude>38.592142</gRingLatitude>
										<gRingLongitude>-103.920288</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.645205</gRingLatitude>
										<gRingLongitude>-103.667603</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.536204</gRingLatitude>
										<gRingLongitude>-103.539886</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.46978</gRingLatitude>
										<gRingLongitude>-103.583832</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.460674</gRingLatitude>
										<gRingLongitude>-103.728027</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.467959</gRingLatitude>
										<gRingLongitude>-103.868103</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.5262</gRingLatitude>
										<gRingLongitude>-103.940887</gRingLongitude>
									</gRingPoint>
									<gRingPoint>
										<gRingLatitude>38.592142</gRingLatitude>
										<gRingLongitude>-103.920288</gRingLongitude>
									</gRingPoint>
								</datasetGPolygonOuterGRing>
							</datasetGPolygon>
						</geographicCoverage>
						<temporalCoverage>
							<rangeOfDates>
								<beginDate>
									<calendarDate>2021-08-06</calendarDate>
								</beginDate>
								<endDate>
									<calendarDate>2021-08-07</calendarDate>
								</endDate>
							</rangeOfDates>
						</temporalCoverage>
					</coverage>
				</studyAreaDescription>
			</relatedProject>
		</project>
	</dataset>
	<additionalMetadata>
		<describes>d26547a9-31f3-4477-9ca4-e8a8e7edc237</describes>
		<metadata>
			<IUCNConservationActions>
				<IUCNConservationAction>
					<IUCNConservationActionLevel1Classification>Education &amp; Training</IUCNConservationActionLevel1Classification>
					<IUCNConservationActionLevel2SubClassification>Formal Education</IUCNConservationActionLevel2SubClassification>
					<IUCNConservationActionLevel3SubClassification>Primary education</IUCNConservationActionLevel3SubClassification>
				</IUCNConservationAction>
			</IUCNConservationActions>
		</metadata>
	</additionalMetadata>
	<additionalMetadata>
		<describes>d26547a9-31f3-4477-9ca4-e8a8e7edc237</describes>
		<metadata>
			<stakeholderPartnerships>
				<stakeholderPartnership>
					<name>Some Partner</name>
				</stakeholderPartnership>
			</stakeholderPartnerships>
		</metadata>
	</additionalMetadata>
	<additionalMetadata>
		<describes>d26547a9-31f3-4477-9ca4-e8a8e7edc237</describes>
		<metadata>
			<projectActivities>
				<projectActivity>
					<name>Monitoring</name>
				</projectActivity>
				<projectActivity>
					<name>Habitat Research</name>
				</projectActivity>
			</projectActivities>
		</metadata>
	</additionalMetadata>
	<additionalMetadata>
		<describes>d26547a9-31f3-4477-9ca4-e8a8e7edc237</describes>
		<metadata>
			<climateChangeInitiatives>
				<climateChangeInitiative>
					<name>Monitoring</name>
				</climateChangeInitiative>
				<climateChangeInitiative>
					<name>Mitigation</name>
				</climateChangeInitiative>
			</climateChangeInitiatives>
		</metadata>
	</additionalMetadata>
	<additionalMetadata>
		<describes>d26547a9-31f3-4477-9ca4-e8a8e7edc237</describes>
		<metadata>
			<firtNations>
				<firtNation>
					<name>Kitselas Nation</name>
				</firtNation>
			</firtNations>
		</metadata>
	</additionalMetadata>
	<additionalMetadata>
		<describes>d26547a9-31f3-4477-9ca4-e8a8e7edc237</describes>
		<metadata>
			<managementActionTypes>
				<managementActionType>
					<name>Recovery Action</name>
				</managementActionType>
			</managementActionTypes>
		</metadata>
	</additionalMetadata>
	<additionalMetadata>
		<describes>d26547a9-31f3-4477-9ca4-e8a8e7edc237</describes>
		<metadata>
			<surveyProprietors>
				<surveyProprietor>
					<firstNationsName>Squamish Nation</firstNationsName>
					<proprietorType>First Nations Land</proprietorType>
					<rationale>proprietor rationale</rationale>
					<proprietorName/>
					<DISARequired>Yes</DISARequired>
				</surveyProprietor>
			</surveyProprietors>
		</metadata>
	</additionalMetadata>
	<additionalMetadata>
		<describes>cad7c99c-a1e7-442c-9239-1db953c83a87</describes>
		<metadata>
			<biohubEML>
				<source>SIMS-SVC</source>
				<version>1.0</version>
			</biohubEML>
		</metadata>
	</additionalMetadata>
</eml:eml>';
	_spatial_transform_id spatial_transform.spatial_transform_id%type;
	_security_transform_id security_transform.security_transform_id%type;
	_submission_spatial_component_id submission_spatial_component.submission_spatial_component_id%type;
	_persecution_or_harm_id persecution_or_harm.persecution_or_harm_id%type;
begin
  -- set security context
  select api_set_context('myIDIR', 'IDIR') into _system_user_id;
  --select api_set_context('biohub_api', 'DATABASE') into _system_user_id;
	select persecution_or_harm_id into _persecution_or_harm_id from persecution_or_harm where name = 'Big Brown Bat winter hibernation sites and maternity roosts';

  select st_GeomFromEWKT('SRID=4326;POINT(-123.920288 48.592142)') into _geography;

	-- source transform
	insert into source_transform (system_user_id, version, metadata_index, metadata_transform) 
		values ((select system_user_id from system_user where user_guid = 'myIDIR'), '2.0', 'biohub_metadata', 'select jsonb_build_object(''datasetTitle'', '''') from submissions where submission_id = ?') returning source_transform_id into _source_transform_id;
	-- spatial transform
	insert into spatial_transform (name, transform, record_effective_date) values ('test spatial transform', 'select * from submission', now()) returning spatial_transform_id into _spatial_transform_id;
	-- security transform
	insert into security_transform (persecution_or_harm_id, name, transform) values (_persecution_or_harm_id, 'test security transform', 'select * from submission') returning security_transform_id into _security_transform_id;
	-- test system user
	insert into system_user (user_identity_source_id, user_guid, user_identifier, record_effective_date) values((select user_identity_source_id from user_identity_source where name = 'IDIR'), 'CHUCK', 'CHUCK', now());

  -- submission 1
  insert into submission (source_transform_id, uuid) values (_source_transform_id, 'cc688fda-5460-4057-b6cc-ce237c78e422') returning submission_id into _submission_id;
	insert into submission_metadata (submission_id, eml_source) values (_submission_id, _eml_source);
	insert into submission_observation (submission_id, darwin_core_source) values (_submission_id, '{}') returning submission_observation_id into _submission_observation_id;
  insert into submission_spatial_component (submission_observation_id, spatial_component) values (_submission_observation_id, '{}') returning submission_spatial_component_id into _submission_spatial_component_id;  
  insert into submission_status (submission_id, submission_status_type_id, event_timestamp) values (_submission_id, (select submission_status_type_id from submission_status_type where name = 'Ingested'), now()-interval '1 day') returning submission_status_id into _submission_status_id;
  -- transpose comments on next three lines to test deletion of published surveys by system administrator
  insert into submission_status (submission_id, submission_status_type_id, event_timestamp) values (_submission_id, (select submission_status_type_id from submission_status_type where name = 'Validated'), now()-interval '1 day') returning submission_status_id into _submission_status_id;
  insert into submission_status (submission_id, submission_status_type_id, event_timestamp) values (_submission_id, (select submission_status_type_id from submission_status_type where name = 'Published'), now()-interval '1 day') returning submission_status_id into _submission_status_id;
	-- xrefs
	insert into spatial_transform_submission (spatial_transform_id, submission_spatial_component_id) values (_spatial_transform_id, _submission_spatial_component_id);
	insert into security_transform_submission (submission_spatial_component_id, security_transform_id) values (_submission_spatial_component_id, _security_transform_id);
	insert into system_user_security_exception (persecution_or_harm_id, system_user_id) values (_persecution_or_harm_id, (select system_user_id from system_user where user_guid = 'CHUCK'));
	insert into submission_job_queue (submission_job_queue_id, submission_id) values ((select nextval('submission_job_queue_seq')), _submission_id);
	insert into artifact (artifact_id, submission_id, uuid, file_name, file_type) values ((select nextval('artifact_seq')), _submission_id, '34ae204d-a2fd-4fed-aa80-521d7e266f36', 'test.pdf', 'pdf');

	select count(1) into _count from submission;
  assert _count = 1, 'FAIL submission(1)';
	select count(1) into _count from submission_metadata;
  assert _count = 1, 'FAIL submission_metadata(1)';
  select count(1) into _count from submission_spatial_component;
  assert _count = 1, 'FAIL submission_spatial_component(1)';
	select count(1) into _count from submission_job_queue;
  assert _count = 1, 'FAIL submission_job_queue(1)';
	select count(1) into _count from artifact;
  assert _count = 1, 'FAIL artifact(1)';

  -- submission 2
  insert into submission (source_transform_id, uuid) values (_source_transform_id, 'c6625835-fce2-4aa4-b2a2-89c7f94824cd') returning submission_id into _submission_id;  
	insert into submission_metadata (submission_id, eml_source) values (_submission_id, _eml_source);
	insert into submission_observation (submission_id, darwin_core_source) values (_submission_id, '{}') returning submission_observation_id into _submission_observation_id;
	insert into submission_spatial_component (submission_observation_id, spatial_component) values (_submission_observation_id, '{}') returning submission_spatial_component_id into _submission_spatial_component_id;
  insert into submission_spatial_component (submission_observation_id, spatial_component) values (_submission_observation_id, '{}');  
  insert into submission_status (submission_id, submission_status_type_id, event_timestamp) values (_submission_id, (select submission_status_type_id from submission_status_type where name = 'Ingested'), now()) returning submission_status_id into _submission_status_id;
  insert into submission_status (submission_id, submission_status_type_id, event_timestamp) values (_submission_id, (select submission_status_type_id from submission_status_type where name = 'Rejected'), now()) returning submission_status_id into _submission_status_id;
  insert into submission_message (submission_status_id, submission_message_type_id, event_timestamp, message) values (_submission_status_id, (select submission_message_type_id from submission_message_type where name = 'Notice'), now(), 'Some required field was not supplied.');
	insert into submission_job_queue (submission_job_queue_id, submission_id) values ((select nextval('submission_job_queue_seq')), _submission_id);
	insert into artifact (artifact_id, submission_id, uuid, file_name, file_type) values ((select nextval('artifact_seq')), _submission_id, 'b3b3db37-cefb-4dbf-9af8-e4095bb00dba', 'test.pdf', 'pdf');

	select count(1) into _count from submission;
  assert _count = 2, 'FAIL submission(2)';
	select count(1) into _count from submission_metadata;
  assert _count = 2, 'FAIL submission_metadata(2)';
	select count(1) into _count from submission_spatial_component;
  assert _count = 3, 'FAIL submission_spatial_component(2)';
  select count(1) into _count from submission_status;
  assert _count = 5, 'FAIL submission_status';
  select count(1) into _count from submission_message;
  assert _count = 1, 'FAIL submission_message';
	select count(1) into _count from submission_job_queue;
  assert _count = 2, 'FAIL submission_job_queue(2)';
	select count(1) into _count from artifact;
  assert _count = 2, 'FAIL artifact(2)';

  raise notice 'smoketest_release(2): PASS';
end
$$;
