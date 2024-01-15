-- *******************************************************************
-- Procedure: fn_calculate_area_intersect
-- Purpose: returns true if both geometries intersect by the given tolerance amount (0.4 == 40% coverage)
--
-- MODIFICATION HISTORY
-- Person           Date        Comments
-- ---------------- ----------- --------------------------------------
-- alfred.rosenthal@quartech.com
--                  2024-01-15  initial release
-- *******************************************************************
CREATE OR REPLACE FUNCTION fn_calculate_area_intersect(geom1 geometry, geom2 geometry, tolerance float)
RETURNS boolean AS $$
BEGIN
  RETURN ST_Area(ST_Intersection(geom1, geom2)) / ST_Area(geom1) >= tolerance
         OR ST_Area(ST_Intersection(geom1, geom2)) / ST_Area(geom2) >= tolerance;
END;
$$ LANGUAGE plpgsql;