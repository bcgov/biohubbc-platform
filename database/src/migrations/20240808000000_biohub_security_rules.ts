import { Knex } from 'knex';

/**
 * Inserts new Security Rules, but without associated conditions
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH=biohub;

    ---------------------------------------------------
    -- Insert security categories
    ---------------------------------------------------
    INSERT INTO 
      security_category (name, description, record_effective_date)
    VALUES 
      ('Government Interests', 'Poses a risk to government programs and activities (e.g., legal investigations, treaty negotiations, government to government agreements).', now()),
      ('Species and Ecosystems Susceptible to Persecution or Harm', 'Places populations, residences of species, or occurrences of species or ecosystems at risk of persecution or harm, or intereferes with their conservation or recovery.', now()), 
      ('Proprietary', 'Data collection required access to private or First Nations lands and the land owners or First Nations have requested the data and information not to be distributed.', now()),
      ('Statutory Constraints', 'Violates provincial or federal statutes.', now());


    ----------------------------------------------------------------------------
    -- Insert security rules
    ---------------------------------------------------------------------------
    INSERT INTO 
      security_rule (record_effective_date, security_category_id, name, description)
    VALUES 
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Gyrfalcon', 'Security concern related to gyrfalcon'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Peregrine Falcon', 'Security concern related to peregrine falcon'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Prairie Falcon', 'Security concern related to prairie falcon'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Sharp-tailed Grouse', 'Security concern related to sharp-tailed grouse'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Spotted Owl', 'Security concern related to spotted owl'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Bull Trout', 'Security concern related to bull trout'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Big Brown Bat', 'Security concern related to big brown bat'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Bighorn Sheep', 'Security concern related to bighorn sheep'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'California Myotis', 'Security concern related to california myotis'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Dalls Sheep', 'Security concern related to dalls sheep'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Fringed Myotis', 'Security concern related to fringed myotis'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Little Brown Myotis', 'Security concern related to little brown myotis'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Long-eared Myotis', 'Security concern related to long-eared myotis'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Long-legged Myotis', 'Security concern related to long-legged myotis'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Mountain Goat', 'Security concern related to mountain goat'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Northern Myotis', 'Security concern related to northern myotis'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Pallid Bat', 'Security concern related to pallid bat'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Roosevelt Elk', 'Security concern related to roosevelt elk'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Silver-haired Bat', 'Security concern related to silver-haired bat'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Stones Sheep', 'Security concern related to stones sheep'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Townsends Big-eared Bat', 'Security concern related to townsend''s big-eared bat'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Western Small-footed Myotis', 'Security concern related to western small-footed myotis'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Yuma Myotis', 'Security concern related to yuma myotis'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Slender yoke-moss', 'Security concern related to slender yoke-moss'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Gopher Snake', 'Security concern related to gopher snake'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'North American Racer', 'Security concern related to north american racer'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Western Rattle Snake', 'Security concern related to western rattle snake'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Mineral Lick Locations', 'Security concern related to mineral lick locations'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Telemetry Hardware', 'Security concern related to telemetry hardware'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Proprietary'), 'Private Land', 'Proprietary due to private land'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Proprietary'), 'Time-Limited Restriction', 'Proprietary due to time-limited restriction'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Proprietary'), 'First Nations Land', 'Proprietary due to first nations land'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Statutory Constraints'), 'Provincial Statute', 'Secured due to provincial statutes'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Statutory Constraints'), 'Federal Statute', 'Secured due to federal statutes'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Mule Deer', 'Secured due to revealing sensitive information about mule deer'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Experimental Technology', 'Secured due to experimental technology potentially revealing sensitive information'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Predator Reduction', 'Secured due to potentially revealing sensitive information about predator reduction'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Bighorn or Thinhorn Sheep', 'Secured due to revealing sensitive information about bighorn or thinhorn sheep'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Rocky Mountain Elk', 'Secured due to revealing sensitive information about rocky mountain elk'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Harvested Species', 'Secured due to revealing sensitive information about harvested species'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Caribou', 'Secured due to revealing sensitive information about caribou'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Moose', 'Secured due to revealing sensitive information about moose'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Grey Wolf', 'Secured due to revealing sensitive information about grey wolf'),
      (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Grizzly Bear', 'Secured due to revealing sensitive information about grizzly bear');
    `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
