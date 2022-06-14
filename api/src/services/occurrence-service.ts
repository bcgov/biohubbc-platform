import { Feature } from 'geojson';
import { IDBConnection } from '../database/db';
import { IGetOccurrenceData, IPostOccurrenceData, OccurrenceRepository } from '../repositories/occurrence-repository';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { DBService } from './db-service';

export interface DwCAOccurrenceRows {
  eventRows: string[][] | undefined;
  occurrenceRows: string[][] | undefined;
  taxonRows: string[][] | undefined;
}

export interface DwCAOccurrenceHeaders {
  eventHeaders: string[] | undefined;
  eventIdHeader: number;
  eventVerbatimCoordinatesHeader: number;
  eventDateHeader: number;
  occurrenceHeaders: string[] | undefined;
  occurrenceIdHeader: number;
  associatedTaxaHeader: number;
  lifeStageHeader: number;
  sexHeader: number;
  individualCountHeader: number;
  organismQuantityHeader: number;
  organismQuantityTypeHeader: number;
  taxonHeaders: string[] | undefined;
  taxonIdHeader: number;
  vernacularNameHeader: number;
}

//Interface for Occurrence feature popup
export interface IGetMapOccurrenceData {
  id: number;
  taxonid: string | undefined;
  geometry: Feature | undefined;
  observations: [
    {
      eventdate: string | undefined;
      data: IGetOrganismData[];
    }
  ];
}

export interface IGetOrganismData {
  lifestage: string | undefined;
  vernacularname: string | undefined;
  sex: string | undefined;
  individualcount: number | undefined;
  organismquantity: number | undefined;
  organismquantitytype: string | undefined;
}

export class OccurrenceService extends DBService {
  occurrenceRepository: OccurrenceRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.occurrenceRepository = new OccurrenceRepository(connection);
  }

  /**
   * Get all occurrences within map bounds and format the results
   *
   * @param {(string | undefined)} [mapView]
   * @return {*}  {Promise<IGetMapOccurrenceData[]>}
   * @memberof OccurrenceService
   */
  async getMapOccurrences(mapView?: Feature | undefined): Promise<IGetMapOccurrenceData[]> {
    // const allOccurrences = await this.occurrenceRepository.getMapOccurrences(mapView);
    console.log(mapView);
    return []; // this.formatOccurrenceDataForMap(allOccurrences);
  }

  /**
   * Format and curate raw data from occurrences
   * First sort by same taxonid and geometry
   *
   * @param {IGetOccurrenceData[]} occurrenceData
   * @return {*}  {IGetMapOccurrenceData[]}
   * @memberof OccurrenceService
   */
  formatOccurrenceDataForMap(occurrenceData: IGetOccurrenceData[]): IGetMapOccurrenceData[] {
    const curatedOccurrences: IGetMapOccurrenceData[] = [];

    //For each occurrence row in the table
    for (const occurrence of occurrenceData) {
      //Find index by same taxonid and geometry
      const findByTaxonGeometry = curatedOccurrences.findIndex((check) => {
        return check.taxonid == occurrence.taxonid && occurrence.geometry == check.geometry;
      });

      //If index exists sort further by date
      if (findByTaxonGeometry != -1) {
        curatedOccurrences[findByTaxonGeometry].observations = this.formatObservationByDate(
          curatedOccurrences[findByTaxonGeometry].observations,
          occurrence
        );
      } else {
        //If index does not exist add new curated taxon and geometry occurrence
        curatedOccurrences.push({
          id: occurrence.occurrence_id,
          taxonid: occurrence.taxonid,
          geometry: occurrence.geometry,
          observations: [
            {
              eventdate: occurrence.eventdate,
              data: [
                {
                  lifestage: occurrence.lifestage,
                  vernacularname: occurrence.vernacularname,
                  sex: occurrence.sex,
                  individualcount: occurrence.individualcount,
                  organismquantity: occurrence.organismquantity,
                  organismquantitytype: occurrence.organismquantitytype
                }
              ]
            }
          ]
        });
      }
    }
    return curatedOccurrences;
  }

  /**
   * Format and curate raw data from occurrences
   * Second sort by same date
   *
   * @param {IGetMapOccurrenceData['observations']} curatedOccurrencesObservations
   * @param {IGetOccurrenceData} occurrence
   * @return {*}  {IGetMapOccurrenceData['observations']}
   * @memberof OccurrenceService
   */
  formatObservationByDate(
    curatedOccurrencesObservations: IGetMapOccurrenceData['observations'],
    occurrence: IGetOccurrenceData
  ): IGetMapOccurrenceData['observations'] {
    //Find index by same date
    const findByEventDate = curatedOccurrencesObservations.findIndex((check) => {
      return String(check.eventdate) == String(occurrence.eventdate);
    });

    //If index exists sort further by lifestage and sex
    if (findByEventDate != -1) {
      curatedOccurrencesObservations[findByEventDate].data = this.formatObservationByLifestageSex(
        curatedOccurrencesObservations[findByEventDate].data,
        occurrence
      );
    } else {
      //If index does not exist add new curated date occurrence
      curatedOccurrencesObservations.push({
        eventdate: occurrence.eventdate,
        data: [
          {
            lifestage: occurrence.lifestage,
            vernacularname: occurrence.vernacularname,
            sex: occurrence.sex,
            individualcount: occurrence.individualcount,
            organismquantity: occurrence.organismquantity,
            organismquantitytype: occurrence.organismquantitytype
          }
        ]
      });
    }

    return curatedOccurrencesObservations;
  }

  /**
   * Format and curate raw data from occurrences
   * Third sort by same lifestage and sex, increment individual count //TODO increment organismquantity if valid
   *
   * @param {IGetOrganismData[]} curatedData
   * @param {IGetOccurrenceData} occurrence
   * @return {*}  {IGetOrganismData[]}
   * @memberof OccurrenceService
   */
  formatObservationByLifestageSex(curatedData: IGetOrganismData[], occurrence: IGetOccurrenceData): IGetOrganismData[] {
    //Find index by same lifestage and sex
    const findBySexLifestage = curatedData.findIndex((check) => {
      return check.lifestage == occurrence.lifestage && check.sex == occurrence.sex;
    });

    //If index exists then increase individual count
    if (findBySexLifestage != -1) {
      //TODO increment organismquantity if valid
      curatedData[findBySexLifestage].individualcount =
        Number(curatedData[findBySexLifestage].individualcount) + Number(occurrence.individualcount);
    } else {
      //If index does not exist add new curated lifestage and sex occurrence
      curatedData.push({
        lifestage: occurrence.lifestage,
        vernacularname: occurrence.vernacularname,
        sex: occurrence.sex,
        individualcount: occurrence.individualcount,
        organismquantity: occurrence.organismquantity,
        organismquantitytype: occurrence.organismquantitytype
      });
    }

    return curatedData;
  }

  /**
   * Get Occurrence row associated to occurrence Id.
   *
   * @param {number} occurrenceId
   * @return {*}  {Promise<IGetOccurrenceData[]>}
   * @memberof OccurrenceService
   */
  async getOccurrenceSubmission(occurrenceId: number): Promise<IGetOccurrenceData> {
    return this.occurrenceRepository.getOccurrenceSubmission(occurrenceId);
  }

  /**
   * Insert scraped occurrence data.
   *
   * @param {number} submissionId
   * @param {IPostOccurrenceData} scrapedOccurrence
   * @return {*}  {Promise<{ occurrence_id: number }>}
   * @memberof OccurrenceService
   */
  async insertScrapedOccurrence(
    submissionId: number,
    scrapedOccurrence: IPostOccurrenceData
  ): Promise<{ occurrence_id: number }> {
    return this.occurrenceRepository.insertScrapedOccurrence(submissionId, scrapedOccurrence);
  }

  /**
   * Scrape submission file for occurrence data and upload to db.
   *
   * @param {number} occurrenceSubmissionId
   * @param {DWCArchive} dwcArchive
   * @return {*}  {Promise<{ occurrence_id: number }[]>}
   * @memberof OccurrenceService
   */
  async scrapeAndUploadOccurrences(
    occurrenceSubmissionId: number,
    dwcArchive: DWCArchive
  ): Promise<{ occurrence_id: number }[]> {
    const { rows, headers } = this.getHeadersAndRowsFromFile(dwcArchive);

    const scrapedOccurrences = this.scrapeOccurrences(rows, headers);

    return Promise.all(
      scrapedOccurrences?.map(async (scrapedOccurrence: any) => {
        return this.insertScrapedOccurrence(occurrenceSubmissionId, scrapedOccurrence);
      }) || []
    );
  }

  /**
   * Scrape row data, for occurrences
   *
   * @param {DwCAOccurrenceRows} rows
   * @param {DwCAOccurrenceHeaders} headers
   * @return {*}  {IPostOccurrenceData[]}
   * @memberof OccurrenceService
   */
  scrapeOccurrences(rows: DwCAOccurrenceRows, headers: DwCAOccurrenceHeaders): IPostOccurrenceData[] {
    if (!rows?.occurrenceRows?.length) {
      return [];
    }

    return rows.occurrenceRows.map((row) => {
      const occurrenceId = row[headers.occurrenceIdHeader];
      const associatedTaxa = row[headers.associatedTaxaHeader];
      const lifeStage = row[headers.lifeStageHeader];
      const sex = row[headers.sexHeader];
      const individualCount = row[headers.individualCountHeader];
      const organismQuantity = row[headers.organismQuantityHeader];
      const organismQuantityType = row[headers.organismQuantityTypeHeader];

      let verbatimCoordinates;
      let eventDate;

      rows.eventRows?.forEach((eventRow) => {
        if (eventRow[headers.eventIdHeader] === occurrenceId) {
          eventDate = eventRow[headers.eventDateHeader];
          verbatimCoordinates = eventRow[headers.eventVerbatimCoordinatesHeader];
        }
      });

      let vernacularName;

      rows.taxonRows?.forEach((taxonRow) => {
        if (taxonRow[headers.taxonIdHeader] === occurrenceId) {
          vernacularName = taxonRow[headers.vernacularNameHeader];
        }
      });

      return {
        associatedTaxa: associatedTaxa,
        lifeStage: lifeStage,
        sex: sex,
        individualCount: individualCount,
        vernacularName: vernacularName || '', //TODO How to handle undefined
        verbatimCoordinates: verbatimCoordinates || '',
        organismQuantity: organismQuantity,
        organismQuantityType: organismQuantityType,
        eventDate: eventDate || ''
      };
    });
  }

  /**
   * Collect headers and rows from submission file
   *
   * @param {DWCArchive} dwcArchive
   * @return {*}  {{ rows: DwCAOccurrenceRows; headers: DwCAOccurrenceHeaders }}
   * @memberof OccurrenceService
   */
  getHeadersAndRowsFromFile(dwcArchive: DWCArchive): { rows: DwCAOccurrenceRows; headers: DwCAOccurrenceHeaders } {
    const eventRows = dwcArchive.worksheets.event?.getRows();
    const eventHeaders = dwcArchive.worksheets.event?.getHeaders();

    const eventIdHeader = eventHeaders?.indexOf('id') as number;
    const eventVerbatimCoordinatesHeader = eventHeaders?.indexOf('verbatimCoordinates') as number;
    const eventDateHeader = eventHeaders?.indexOf('eventDate') as number;

    const occurrenceHeaders = dwcArchive.worksheets.occurrence?.getHeaders();
    const occurrenceRows = dwcArchive.worksheets.occurrence?.getRows();

    const occurrenceIdHeader = occurrenceHeaders?.indexOf('id') as number;
    const associatedTaxaHeader = occurrenceHeaders?.indexOf('associatedTaxa') as number;
    const lifeStageHeader = occurrenceHeaders?.indexOf('lifeStage') as number;
    const sexHeader = occurrenceHeaders?.indexOf('sex') as number;
    const individualCountHeader = occurrenceHeaders?.indexOf('individualCount') as number;
    const organismQuantityHeader = occurrenceHeaders?.indexOf('organismQuantity') as number;
    const organismQuantityTypeHeader = occurrenceHeaders?.indexOf('organismQuantityType') as number;

    const taxonHeaders = dwcArchive.worksheets.taxon?.getHeaders();
    const taxonRows = dwcArchive.worksheets.taxon?.getRows();
    const taxonIdHeader = taxonHeaders?.indexOf('id') as number;
    const vernacularNameHeader = taxonHeaders?.indexOf('vernacularName') as number;

    const rows = {
      eventRows: eventRows,
      occurrenceRows: occurrenceRows,
      taxonRows: taxonRows
    };

    const headers = {
      eventHeaders: eventHeaders,
      eventIdHeader: eventIdHeader,
      eventVerbatimCoordinatesHeader: eventVerbatimCoordinatesHeader,
      eventDateHeader: eventDateHeader,
      occurrenceHeaders: occurrenceHeaders,
      occurrenceIdHeader: occurrenceIdHeader,
      associatedTaxaHeader: associatedTaxaHeader,
      lifeStageHeader: lifeStageHeader,
      sexHeader: sexHeader,
      individualCountHeader: individualCountHeader,
      organismQuantityHeader: organismQuantityHeader,
      organismQuantityTypeHeader: organismQuantityTypeHeader,
      taxonHeaders: taxonHeaders,
      taxonIdHeader: taxonIdHeader,
      vernacularNameHeader: vernacularNameHeader
    };

    return {
      rows,
      headers
    };
  }
}
