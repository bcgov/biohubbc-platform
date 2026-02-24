import { v4 as uuidv4 } from 'uuid';
import { DataRequestWithStatus, FlatDataRequestWithStatus } from '../models/data-request';

/**
 * Generates a unique team name for auto-created data request teams.
 *
 * @returns {string} A unique team name.
 */
export function _generateDataRequestTeamName(): string {
  return `Data request team - ${uuidv4()}`;
}

/**
 * Transforms a flat data request structure (with status fields at the top level)
 * into a nested structure with a data_request_status object.
 *
 * @param {FlatDataRequestWithStatus} flatDataRequest - The flat data request object
 * @returns {DataRequestWithStatus} The nested data request object
 */
export function _transformFlatDataRequestToNested(flatDataRequest: FlatDataRequestWithStatus): DataRequestWithStatus {
  return {
    data_request_id: flatDataRequest.data_request_id,
    reason: flatDataRequest.reason,
    team_id: flatDataRequest.team_id,
    requested_by: flatDataRequest.requested_by,
    data_request_status: {
      data_request_status_id: flatDataRequest.data_request_status_id,
      data_request_id: flatDataRequest.data_request_id,
      comment_id: flatDataRequest.comment_id,
      request_status: flatDataRequest.request_status
    }
  };
}
