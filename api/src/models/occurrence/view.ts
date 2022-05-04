import { Feature } from 'geojson';

/**
 * Pre-processes GET occurrences data for view-only purposes
 *
 * @export
 * @class GetOccurrencesViewData
 */
export class GetOccurrencesViewData {
  occurrences: IGetOccurrencesViewData[];

  constructor(occurrencesData?: any) {
    this.occurrences = occurrencesData?.map((occurrence: any) => {
      const feature =
        (occurrence.geometry && { type: 'Feature', geometry: JSON.parse(occurrence.geometry), properties: {} }) || null;

      return {
        occurrenceId: occurrence.occurrence_id,
        submissionId: occurrence.submission_id,
        taxonId: occurrence.taxonid,
        lifeStage: occurrence.lifestage,
        sex: occurrence.sex,
        eventDate: occurrence.eventdate,
        vernacularName: occurrence.vernacularname,
        individualCount: Number(occurrence.individualcount),
        organismQuantity: Number(occurrence.organismquantity),
        organismQuantityType: occurrence.organismquantitytype,
        geometry: feature
      };
    });
  }
}

export interface IGetOccurrencesViewData {
  occurrenceId: number;
  submissionId: number;
  taxonId: string;
  lifeStage: string;
  sex: string;
  eventDate: string; //TODO is this a timeStamp?
  vernacularName: string;
  individualCount: number;
  organismQuantity: number;
  organismQuantityType: string;
  geometry: Feature;
}
