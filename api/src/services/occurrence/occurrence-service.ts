import { IDBConnection } from '../../database/db';
import {
  IGetOccurrenceData,
  IPostOccurrenceData,
  OccurrenceRepository
} from '../../repositories/occurrence-repository';
import { DWCArchive } from '../../utils/media/dwc/dwc-archive-file';
import { DBService } from '../service';

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
   * @return {*}  {Promise<GetOccurrencesViewData>}
   * @memberof OccurrenceService
   */
  async getOccurrenceSubmission(occurrenceId: number): Promise<IGetOccurrenceData[]> {
    return this.occurrenceRepository.getOccurrenceSubmission(occurrenceId);
  }

  /**
   * Upload scraped occurrence data.
   *
   * @param {number} submissionId
   * @param {PostOccurrence} scrapedOccurrence
   * @memberof OccurrenceService
   */
  async uploadScrapedOccurrence(submissionId: number, scrapedOccurrence: IPostOccurrenceData) {
    return this.occurrenceRepository.uploadScrapedOccurrence(submissionId, scrapedOccurrence);
  }

  /**
   * Scrape submission file for occurence data and upload to db.
   *
   * @param {number} occurrenceSubmissionId
   * @param {DWCArchive} dwcArchive
   * @memberof OccurrenceService
   */
  async scrapeAndUploadOccurrences(occurrenceSubmissionId: number, dwcArchive: DWCArchive) {
    const {
      occurrenceRows,
      occurrenceIdHeader,
      associatedTaxaHeader,
      eventRows,
      lifeStageHeader,
      sexHeader,
      individualCountHeader,
      organismQuantityHeader,
      organismQuantityTypeHeader,
      occurrenceHeaders,
      eventIdHeader,
      eventDateHeader,
      eventVerbatimCoordinatesHeader,
      taxonRows,
      taxonIdHeader,
      vernacularNameHeader
    } = this.getHeadersAndRowsFromFile(dwcArchive);

    const scrapedOccurrences = occurrenceRows?.map(
      (row: any): IPostOccurrenceData => {
        const occurrenceId = row[occurrenceIdHeader];
        const associatedTaxa = row[associatedTaxaHeader];
        const lifeStage = row[lifeStageHeader];
        const sex = row[sexHeader];
        const individualCount = row[individualCountHeader];
        const organismQuantity = row[organismQuantityHeader];
        const organismQuantityType = row[organismQuantityTypeHeader];

        const data = { headers: occurrenceHeaders, rows: row };

        let verbatimCoordinates;
        let eventDate;

        eventRows?.forEach((eventRow: any) => {
          if (eventRow[eventIdHeader] === occurrenceId) {
            eventDate = eventRow[eventDateHeader];
            verbatimCoordinates = eventRow[eventVerbatimCoordinatesHeader];
          }
        });

        let vernacularName;

        taxonRows?.forEach((taxonRow: any) => {
          if (taxonRow[taxonIdHeader] === occurrenceId) {
            vernacularName = taxonRow[vernacularNameHeader];
          }
        });

        return {
          associatedTaxa: associatedTaxa,
          lifeStage: lifeStage,
          sex: sex,
          individualCount: individualCount,
          vernacularName: vernacularName || '',
          data: data,
          verbatimCoordinates: verbatimCoordinates || '',
          organismQuantity: organismQuantity,
          organismQuantityType: organismQuantityType,
          eventDate: eventDate || ''
        };
      }
    );

    await Promise.all(
      scrapedOccurrences?.map(async (scrapedOccurrence: any) => {
        await this.uploadScrapedOccurrence(occurrenceSubmissionId, scrapedOccurrence);
      }) || []
    );
  }

  /**
   * Collect headers and rows from subbmission file
   *
   * @param {DWCArchive} dwcArchive
   * @return {*}
   * @memberof OccurrenceService
   */
  private getHeadersAndRowsFromFile(dwcArchive: DWCArchive) {
    const eventHeaders = dwcArchive.worksheets.event?.getHeaders();
    const eventRows = dwcArchive.worksheets.event?.getRows();

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

    return {
      occurrenceRows,
      occurrenceIdHeader,
      associatedTaxaHeader,
      eventRows,
      lifeStageHeader,
      sexHeader,
      individualCountHeader,
      organismQuantityHeader,
      organismQuantityTypeHeader,
      occurrenceHeaders,
      eventIdHeader,
      eventDateHeader,
      eventVerbatimCoordinatesHeader,
      taxonRows,
      taxonIdHeader,
      vernacularNameHeader
    };
  }
}
