import { Knex } from 'knex';

/**
 * this adds new security rules to biohub
 * insert comments here
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
   ---------------------------------------------------
   ----- inserting reasons into category table -------
   ---------------------------------------------------
    INSERT INTO security_category(name, description, record_Effective_date)
    VALUES 
    ('Government Interests', 'Government Interests', now()),
    ('Species and Ecosystems Susceptible to Persecution or Harm', 'Species and Ecosystems Susceptible to Persecution or Harm', now()), 
    ('Proprietary', 'Proprietary', now()),
    ('Statutory Constraints', 'Statutory Constraints', now());


    ----------------------------------------------------------------------------
    -------------------- inserting securty rules dependent on category table --
    ---------------------------------------------------------------------------
    INSERT INTO security_rule (record_effective_date, security_category_id, name, description)
    VALUES 
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Gyrfalcon', 'Security Concern Related to Gyrfalcon'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Peregrine Falcon', 'Security Concern Related to Peregrine Falcon'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Prairie Falcon', 'Security Concern Related to Prairie Falcon'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Sharp-tailed Grouse', 'Security Concern Related to Sharp-tailed Grouse'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Spotted Owl', 'Security Concern Related to Spotted Owl'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Bull Trout', 'Security Concern Related to Bull Trout'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Big Brown Bat', 'Security Concern Related to Big Brown Bat'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Bighorn Sheep', 'Security Concern Related to Bighorn Sheep'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'California Myotis', 'Security Concern Related to California Myotis'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Dalls Sheep', 'Security Concern Related to Dalls Sheep'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Fringed Myotis', 'Security Concern Related to Fringed Myotis'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Keens Myotis (now Long-eared Myotis)', 'Security Concern Related to Keens Myotis (now Long-eared Myotis)'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Little Brown Myotis', 'Security Concern Related to Little Brown Myotis'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Long-eared Myotis', 'Security Concern Related to Long-eared Myotis'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Long-legged Myotis', 'Security Concern Related to Long-legged Myotis'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Mountain Goat', 'Security Concern Related to Mountain Goat'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Northern Myotis', 'Security Concern Related to Northern Myotis'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Pallid Bat', 'Security Concern Related to Pallid Bat'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Roosevelt Elk', 'Security Concern Related to Roosevelt Elk'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Silver-haired Bat', 'Security Concern Related to Silver-haired Bat'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Stones Sheep', 'Security Concern Related to Stones Sheep'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Townsends Big-eared Bat', 'Security Concern Related to Townsends Big-eared Bat'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Western Small-footed Myotis', 'Security Concern Related to Western Small-footed Myotis'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Yuma Myotis', 'Security Concern Related to Yuma Myotis'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Slender yoke-moss', 'Security Concern Related to Slender yoke-moss'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Gopher Snake', 'Security Concern Related to Gopher Snake'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'North American Racer', 'Security Concern Related to North American Racer'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Western Rattle Snake', 'Security Concern Related to Western Rattle Snake'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Mineral Lick Locations', 'Security Concern Related to Mineral Lick Locations'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Species and Ecosystems Susceptible to Persecution or Harm'), 'Telemetry Hardware', 'Security Concern Related to Telemetry Hardware'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Proprietary'), 'Private Land', 'Proprietary due to Private Land'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Proprietary'), 'Time-Limited Restriction', 'Proprietary due to Time-Limited Restriction'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Proprietary'), 'First Nations Land', 'Proprietary due to First Nations Land'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Statutory Constraints'), 'Provincial Statute', 'Secured due to Provincial Statute'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Statutory Constraints'), 'Federal Statute', 'Secured due to Federal Statute'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Mule Deer Data', 'Secured due to Mule Deer Data'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Experimental Technology', 'Secured due to Experimental Technology'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Predator Reduction', 'Secured due to Predator Reduction Information'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Bighorn or Thinhorn Sheep', 'Secured due to Species of Sheep'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Rocky Mountain Elk Data', 'Secured due to Rocky Mountain Elk Data'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Harvested Species', 'Secured due to Increased Risk of Illegal Harvest'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Caribou Data', 'Secured due to association with Secured Caribou Data'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Moose Data', 'Secured Moose Data'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Grey Wolf Data', 'Secured Grey Wolf Data'),
    (now(), (SELECT security_category_id FROM security_category WHERE name = 'Government Interests'), 'Grizzly Bear Data', 'Secured due to Grizzly Bear Data');
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
