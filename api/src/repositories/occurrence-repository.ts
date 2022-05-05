import { Feature } from 'geojson';
import SQL from 'sql-template-strings';
import { getKnexQueryBuilder } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { parseLatLongString, parseUTMString } from '../utils/spatial-utils';
import { BaseRepository } from './base-repository';

export interface IGetOccurrenceData {
  occurrenceId: number;
  submissionId: number;
  taxonId: string | null;
  lifeStage: string | null;
  sex: string | null;
  eventDate: string | null; //TODO is this a timeStamp?
  vernacularName: string | null;
  individualCount: number | null;
  organismQuantity: number | null;
  organismQuantityType: string | null;
  geometry: Feature | null;
}

export interface IPostOccurrenceData {
  associatedTaxa: string | null;
  lifeStage: string | null;
  sex: string | null;
  data: object | null;
  verbatimCoordinates: string | null;
  individualCount: number | null;
  vernacularName: string | null;
  organismQuantity: string | null;
  organismQuantityType: string | null;
  eventDate: string | null;
}

/**
 * A repository class for accessing occurrence data.
 *
 * @export
 * @class OccurrenceRepository
 * @extends {BaseRepository}
 */
export class OccurrenceRepository extends BaseRepository {
  /**
   * Upload scraped occurrence data.
   *
   * @param {number} submissionId
   * @param {PostOccurrence} scrapedOccurrence
   * @memberof OccurrenceService
   */
  async uploadScrapedOccurrence(
    submissionId: number,
    scrapedOccurrence: IPostOccurrenceData
  ): Promise<{ occurrence_id: number }> {
    const queryBuilder = getKnexQueryBuilder().insert({
      submission_id: submissionId,

      taxonid: scrapedOccurrence.associatedTaxa,
      lifestage: scrapedOccurrence.lifeStage,
      sex: scrapedOccurrence.sex,
      vernacularname: scrapedOccurrence.vernacularName,
      eventdate: scrapedOccurrence.eventDate,
      individualcount: scrapedOccurrence.individualCount,
      organismquantity: scrapedOccurrence.organismQuantity,
      organismquantitytype: scrapedOccurrence.organismQuantityType,
      geography: ''
    }).from;
    const sqlStatement = SQL`
      INSERT INTO occurrence (
        submission_id
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
        ${scrapedOccurrence.associatedTaxa},
        ${scrapedOccurrence.lifeStage},
        ${scrapedOccurrence.sex},
        ${scrapedOccurrence.vernacularName},
        ${scrapedOccurrence.eventDate},
        ${scrapedOccurrence.individualCount},
        ${scrapedOccurrence.organismQuantity},
        ${scrapedOccurrence.organismQuantityType}
    `;

    const utm = parseUTMString(scrapedOccurrence.verbatimCoordinates || '');
    const latLong = parseLatLongString(scrapedOccurrence.verbatimCoordinates || '');

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

    sqlStatement.append(') RETURNING occurrence_id;');

    const response = await this.connection.sql<{ occurrence_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert occurrence data'); //TODO is sql connections an api error or http?
    }

    return response.rows[0];
  }

  /**
   * Get Occurrence row associated to occurrence Id.
   *
   * @param {number} occurrenceId
   * @return {*}  {Promise<GetOccurrencesViewData>}
   * @memberof OccurrenceRepository
   */
  async getOccurrenceSubmission(occurrenceId: number): Promise<IGetOccurrenceData[]> {
    const sqlStatement = SQL`
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

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get occurrence record'); //TODO is sql connections an api error or http?
    }

    return response.rows[0];
  }
}
