-- populate_system_metadata_constant.sql

-- system metadata tombstone data
insert into system_metadata_constant (constant_name, character_value, description) values ('ORGANIZATION_NAME_FULL', 'Knowledge Management Branch, Ministry of Enivronment and Climate Change Strategy, Government of British Columbia', 'The organizations full name. This value is used in the production of published ecological metadata language files.');
insert into system_metadata_constant (constant_name, character_value, description) values ('ORGANIZATION_URL', 'https://www2.gov.bc.ca/gov/content/governments/organizational-structure/ministries-organizations/ministries/environment-climate-change', 'The organizations public facing URL. This value is used in the production of published ecological metadata language files.');
