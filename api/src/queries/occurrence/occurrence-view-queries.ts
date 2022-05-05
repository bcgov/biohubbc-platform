import { SQL, SQLStatement } from 'sql-template-strings';

//TODO DELETE FILE

export const getOccurrencesForViewSQL = (occurrenceId: number): SQLStatement => {
  return SQL`
      SELECT
        o.occurrence_id,
        o.submission_id,
        o.occurrenceid,
        o.taxonid,
        o.lifestage,
        o.sex,
        o.vernacularname,
        o.eventdate,
        o.individualcount,
        o.organismquantity,
        o.organismquantitytype,
        public.ST_asGeoJSON(o.geography) as geometry
      FROM
        occurrence as o
      LEFT OUTER JOIN
        occurrence_submission as os
      ON
        o.occurrence_submission_id = os.occurrence_submission_id
      WHERE
        o.occurrence_submission_id = ${occurrenceId}
      AND
        os.delete_timestamp is null;
    `;
};
