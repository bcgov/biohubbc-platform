import { IDBConnection } from '../database/db';
import { IGetOccurrenceData, IPostOccurrenceData, OccurrenceRepository } from '../repositories/occurrence-repository';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { DBService } from './db-service';

export class OccurrenceService extends DBService {
  occurrenceRepository: OccurrenceRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.occurrenceRepository = new OccurrenceRepository(connection);
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

    const uploadResponse = await Promise.all(
      scrapedOccurrences?.map(async (scrapedOccurrence: any) => {
        return this.insertScrapedOccurrence(occurrenceSubmissionId, scrapedOccurrence);
      }) || []
    );

    return uploadResponse;
  }

  /**
   * Scrape row data, for occurrences
   *
   * @param {*} rows
   * @param {*} headers
   * @return {*}  {IPostOccurrenceData[]}
   * @memberof OccurrenceService
   */
  scrapeOccurrences(rows: any, headers: any): IPostOccurrenceData[] {
    return rows.occurrenceRows?.map(
      (row: any): IPostOccurrenceData => {
        const occurrenceId = row[headers.occurrenceIdHeader];
        const associatedTaxa = row[headers.associatedTaxaHeader];
        const lifeStage = row[headers.lifeStageHeader];
        const sex = row[headers.sexHeader];
        const individualCount = row[headers.individualCountHeader];
        const organismQuantity = row[headers.organismQuantityHeader];
        const organismQuantityType = row[headers.organismQuantityTypeHeader];

        let verbatimCoordinates;
        let eventDate;

        row.eventRows?.forEach((eventRow: any) => {
          if (eventRow[headers.eventIdHeader] === occurrenceId) {
            eventDate = eventRow[headers.eventDateHeader];
            verbatimCoordinates = eventRow[headers.eventVerbatimCoordinatesHeader];
          }
        });

        let vernacularName;

        row.taxonRows?.forEach((taxonRow: any) => {
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
      }
    );
  }

  /**
   * Collect headers and rows from submission file
   *
   * @param {DWCArchive} dwcArchive
   * @return {*}
   * @memberof OccurrenceService
   */
  private getHeadersAndRowsFromFile(dwcArchive: DWCArchive) {
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
