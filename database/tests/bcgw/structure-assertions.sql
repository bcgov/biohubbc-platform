-- The four observation exports partition the domain rows without overlap.
DO $$ BEGIN
 ASSERT NOT EXISTS (
   (SELECT feature_id FROM bcgw.wld_observations_all INTERSECT SELECT feature_id FROM bcgw.wld_incidental_all)
 ), 'site membership partitions observations';
 ASSERT NOT EXISTS (
   (SELECT feature_id FROM bcgw_internal.observation_export_rows EXCEPT
     (SELECT feature_id FROM bcgw.wld_observations_all UNION ALL SELECT feature_id FROM bcgw.wld_incidental_all))
 ), 'every domain observation appears in an export';
 ASSERT NOT EXISTS (
   (SELECT * FROM bcgw.wld_observations_public EXCEPT ALL SELECT * FROM bcgw.wld_observations_all WHERE secured='N')
   UNION ALL
   (SELECT * FROM bcgw.wld_observations_all WHERE secured='N' EXCEPT ALL SELECT * FROM bcgw.wld_observations_public)
 ), 'public observations are the unsecured subset';
 ASSERT NOT EXISTS (
   (SELECT * FROM bcgw.wld_incidental_public EXCEPT ALL SELECT * FROM bcgw.wld_incidental_all WHERE secured='N')
   UNION ALL
   (SELECT * FROM bcgw.wld_incidental_all WHERE secured='N' EXCEPT ALL SELECT * FROM bcgw.wld_incidental_public)
 ), 'public incidental observations are the unsecured subset';
 ASSERT NOT EXISTS (
   (SELECT * FROM bcgw.wld_telemetry_public EXCEPT ALL SELECT * FROM bcgw.wld_telemetry_all WHERE secured='N')
   UNION ALL
   (SELECT * FROM bcgw.wld_telemetry_all WHERE secured='N' EXCEPT ALL SELECT * FROM bcgw.wld_telemetry_public)
 ), 'public telemetry is the unsecured subset';
END $$;
-- Refresh one export after a base-table change. Its sibling snapshot stays unchanged.
SAVEPOINT independent_refresh;
UPDATE biohub.submission_feature_property_number SET value=23 WHERE submission_feature_id=1 AND feature_type_property_id=108;
REFRESH MATERIALIZED VIEW bcgw.wld_observations_public;
DO $$ BEGIN
 ASSERT (SELECT count FROM bcgw.wld_observations_public WHERE feature_id=1)='23';
 ASSERT (SELECT count FROM bcgw.wld_observations_all WHERE feature_id=1)='2';
END $$;
ROLLBACK TO SAVEPOINT independent_refresh;
