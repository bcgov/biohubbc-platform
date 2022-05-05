// @ts-nocheck
import { SQL, SQLStatement } from 'sql-template-strings';
import { parseLatLongString, parseUTMString } from '../../utils/spatial-utils';

//TODO DELETE FILE
export const postOccurrenceSQL = (submissionId: number, occurrence: PostOccurrence): SQLStatement => {
  const sqlStatement: SQLStatement = SQL`
    INSERT INTO occurrence (
      submission_id,
      taxonid,
      lifestage,
      sex,
      vernacularname,
      eventdate,
      individualcount,
      organismquantity,
      organismquantitytype,
      geography
    ) VALUES (
      ${submissionId},
      ${occurrence.associatedTaxa},
      ${occurrence.lifeStage},
      ${occurrence.sex},
      ${occurrence.vernacularName},
      ${occurrence.eventDate},
      ${occurrence.individualCount},
      ${occurrence.organismQuantity},
      ${occurrence.organismQuantityType}
  `;

  const utm = parseUTMString(occurrence.verbatimCoordinates);
  const latLong = parseLatLongString(occurrence.verbatimCoordinates);

  if (utm) {
    // transform utm string into point, if it is not null
    sqlStatement.append(SQL`
      ,public.ST_Transform(
        public.ST_SetSRID(
          public.ST_MakePoint(${utm.easting}, ${utm.northing}),
          ${utm.zone_srid}
        ),
        4326
      )
    `);
  } else if (latLong) {
    // transform latLong string into point, if it is not null
    sqlStatement.append(SQL`
      ,public.ST_Transform(
        public.ST_SetSRID(
          public.ST_MakePoint(${latLong.long}, ${latLong.lat}),
          4326
        ),
        4326
      )
    `);
  } else {
    // insert null geography
    sqlStatement.append(SQL`
        ,null
      `);
  }

  sqlStatement.append(');');

  return sqlStatement;
};
