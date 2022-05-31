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

export interface IGetMapOccurrenceData {
  id: string;
  taxonid: string;
  geometry: Feature;
  dataPoints: [
    {
      eventdate: string;
      data: [
        {
          lifestage: string;
          vernacularname: string;
          sex: string;
          individualcount: number;
          organismquantity: number;
          organismquantitytype: string;
        }
      ];
    }
  ];
}
export class OccurrenceService extends DBService {
  occurrenceRepository: OccurrenceRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.occurrenceRepository = new OccurrenceRepository(connection);
  }

  /**
   * Get all occurrences in table
   *
   * @return {*}  {Promise<IGetOccurrenceData[]>}
   * @memberof OccurrenceService
   */
  async getAllOccurrences(): Promise<IGetMapOccurrenceData[]> {
    const allOccurrences = await this.occurrenceRepository.getAllOccurrences();

    const formated = this.formatOccurrenceDataForMap(allOccurrences);

    return formated;
  }

  formatOccurrenceDataForMap(occurrenceData: IGetOccurrenceData[]): IGetMapOccurrenceData[] {
    const curatedOccurrences: IGetMapOccurrenceData[] = [];

    for (const occur of occurrenceData) {
      // console.log('occur:', occur);
      // console.log('curatedOccurrences:', curatedOccurrences);
      let flagGeoTax = true;

      for (const cur of curatedOccurrences) {
        if (occur.geometry == cur.geometry && occur.taxonid == cur.taxonid) {
          for (const data of cur.dataPoints) {
            if (occur.eventdate == data.eventdate) {
              data.data.push();
            }
          }

          // console.log('sammmmmmee geo');
          cur.dataPoints.push(occur);
          flag = false;
          break;
        }
      }

      if (flagGeoTax) {
        // console.log('Not SAMe geo');
        curatedOccurrences.push({
          id: `${occur.occurrence_id}`,
          taxonid: occur.taxonid,
          geometry: occur.geometry,
          dataPoints: [occur]
        });
      }
    }

    console.log('curatedOccurrences:', curatedOccurrences);

    return curatedOccurrences;
  }

  formatSimilarOccurrences(){

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
