-- *******************************************************************
-- Procedure: fn_calculate_area_intersect
-- Purpose: returns true if both geometries intersect by the given tolerance amount (0.4 == 40% coverage)
-- Assumptions: This function assumes that geom1 will always be a Polygon/ MultiPolygon provided by the system `region_lookup` table.
--
-- MODIFICATION HISTORY
-- Person           Date        Comments
-- ---------------- ----------- --------------------------------------
-- alfred.rosenthal@quartech.com
--                  2024-01-15  initial release
-- *******************************************************************
CREATE OR REPLACE FUNCTION fn_calculate_area_intersect(geom1 geometry, geom2 geometry, tolerance float)
RETURNS boolean AS $$
DECLARE
	intersection_area double precision;
	geometry_1_area double precision;
	geometry_2_area double precision;
	results boolean;
BEGIN
	-- special case to handle single point geometries
	IF ST_GeometryType(geom2) = 'ST_Point' then 
    -- ST_Area returns 0 for an area throwing off the calculation 
    -- So checking ST_Point with ST_Intersects alone provides a more accurate results
	  results := ST_Intersects(geom1, geom2);
	ELSE 
	  SELECT ST_Area(ST_Intersection(geom1, geom2)) INTO intersection_area;
    SELECT ST_Area(geom1) INTO geometry_1_area;
    SELECT ST_Area(geom2) INTO geometry_2_area;
 
    results := intersection_area / geometry_1_area >= tolerance OR intersection_area / geometry_2_area >= tolerance;
	END IF;
	
  RETURN results;
END;
$$ LANGUAGE plpgsql;