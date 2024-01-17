-- *******************************************************************
-- Procedure: fn_calculate_area_intersect
-- Purpose: This function accepts 2 geometries and calculates the area of intersection between them. 
-- 					Once calculated it then compares the percentage of area intersecting to the tolerance value.
-- 					Meaning that intersections of a certain amount will be considering 'intersecting'
-- Example: select fn_calculate_area_intersect('POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))'::geometry, 'POLYGON((5 5, 5 15, 15 15, 15 5, 5 5))'::geometry, 0.2);
-- 					In this example, I expect the function to return true because at least 20% (tolerance of 0.2) of these two geometries are intersecting. 
-- 					
-- 					select fn_calculate_area_intersect('POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))'::geometry, 'POLYGON((5 5, 5 15, 15 15, 15 5, 5 5))'::geometry, 0.3);
--					In this example, I expect the function to return false because the area of intersection is onl 25% not the required 30% (tolerance of 0.3)
-- 					
--					The data in these examples can be visualized in DBeaver with the below sql statement. All these examples can be run in a SQL editor for verification.
-- 					select st_collect('POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))'::geometry, 'POLYGON((5 5, 5 15, 15 15, 15 5, 5 5))'::geometry);
-- Assumptions: This function assumes that geom1 will always be a Polygon/ MultiPolygon provided by the systems `region_lookup` table.
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