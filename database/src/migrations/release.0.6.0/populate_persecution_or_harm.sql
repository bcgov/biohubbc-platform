-- populate_persecution_or_harm.sql

do $$
declare
  _persecution_or_harm_type_id persecution_or_harm_type.persecution_or_harm_type_id%type;
begin
  select persecution_or_harm_type_id from persecution_or_harm_type into _persecution_or_harm_type_id where name = 'Hibernation and Maternity';
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1942, 'Big Brown Bat winter hibernation sites and maternity roosts', 'Data or information about the location of Big Brown Bat winter hibernation sites and maternity roosts.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1947, 'Californian myotis winter hibernation sites and maternity roosts', 'Californian myotis winter hibernation sites and maternity roosts should be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1953, 'Fringed Myotis winter hibernation sites and maternity roosts', 'Fringed Myotis winter hibernation sites and maternity roosts should be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1950, 'All Keens Myotis winter hibernation sites and maternity roosts', 'All Keens Myotis winter hibernation sites and maternity roosts should be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1951, 'Little Brown Myotis winter hibernation sites and maternity roosts', 'Little Brown Myotis winter hibernation sites and maternity roosts should be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1949, 'Long-eared Myotis winter hibernation sites and maternity roosts', 'Long-eared Myotis winter hibernation sites and maternity roosts should be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1954, 'Long-legged Myotis winter hibernation sites and maternity roosts', 'Long-legged Myotis winter hibernation sites and maternity roosts should be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1948, 'Western Small-footed myotis winter hibernation sites and maternity roosts', 'Western Small-footed myotis winter hibernation sites and maternity roosts should be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1955, 'Yuma Myotis winter hibernation sites and maternity roosts', 'Yuma Myotis winter hibernation sites and maternity roosts should be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1952, 'Northern Myotis winter hibernation sites and maternity roosts', 'Northern Myotis winter hibernation sites and maternity roosts should be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1941, 'Pallid bat winter hibernation sites and maternity roosts', 'Data or information about the location of Pallid bat winter hibernation sites and maternity roosts.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1944, 'Silver-haired bat winter hibernation sites and maternity roosts', 'Silver-haired bat winter hibernation sites and maternity roosts should be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1956, 'Townsends Big-eared bat winter hibernation sites and maternity roosts', 'Data or information about the location of Townsends Big-eared bat winter hibernation sites and maternity roosts.');

  select persecution_or_harm_type_id from persecution_or_harm_type into _persecution_or_harm_type_id where name = 'Taxon';
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 2063, 'Bighorn sheep data', 'Bighorn sheep occurrence data, survey and telemetry observations, harvest data should be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 2062, 'Mountain goat data', 'Mountain goat occurrence data, survey and telemetry observations, harvest data should be secured to limit poaching risk.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1716, 'Spotted Owl data', 'Data or information about the location of survey observations (SOs) or telemetry observations (TOs) or incidental observations (IOs) or feature observations (FOs) of Spotted Owl.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 23921, 'Dall''s sheep data', 'All Dall''s sheep occurrence data, survey and telemetry observations, harvest data should be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 23922, 'Stone''s sheep occurrence data', 'All Stone''s sheep occurrence data, survey and telemetry observations, harvest data should be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 30287, 'Slender Yoke-moss data', 'All Slender Yoke-moss observation data should be secured.');

  select persecution_or_harm_type_id from persecution_or_harm_type into _persecution_or_harm_type_id where name = 'Spawning Areas';
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1377, 'Bull Trout spawning areas', 'Bull Trout spawning areas are at risk of poaching and should be automatically secured.');

  select persecution_or_harm_type_id from persecution_or_harm_type into _persecution_or_harm_type_id where name = 'Hibernacula';
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 27102, 'Gopher Snake hibernacula', 'Gopher Snake hibernacula are susceptible to persecution and should be automatically secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 27100, 'North American Racer hibernacula', 'North American Racer hibernacula are susceptible to persecution and should be automatically secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 30965, 'Western Rattlesnake hibernacula', 'Western Rattlesnake hibernacula are susceptible to persecution and should be automatically secured.');

  select persecution_or_harm_type_id from persecution_or_harm_type into _persecution_or_harm_type_id where name = 'Nests';
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1582, 'Gyrfalcon nest locations', 'Gyrfalcon nest locations should all be secured.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1581, 'Peregrine Falcon nest locations', 'Data or information about the location of nests of Peregrine Falcon.');
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1583, 'Prairie Falcon nest location', 'Data or information about the location of nests of Prairie Falcon.');
  
  select persecution_or_harm_type_id from persecution_or_harm_type into _persecution_or_harm_type_id where name = 'Nests';
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 1594, 'Sharp-tailed Grouse nests', 'Data or information about the location of leks of Sharp-tailed Grouse.');

  select persecution_or_harm_type_id from persecution_or_harm_type into _persecution_or_harm_type_id where name = 'Mineral Lick';
  insert into persecution_or_harm (persecution_or_harm_type_id, wldtaxonomic_units_id, name, description) values (_persecution_or_harm_type_id, 917, 'Ungulate mineral lick locations', 'All ungulate mineral lick locations should be secured.');
end
$$;