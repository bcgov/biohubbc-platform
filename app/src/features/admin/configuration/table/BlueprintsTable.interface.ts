import { IBlueprint } from 'interfaces/useBlueprintsApi.interface';
import { ConfigurationStatus } from '../utils/lifecycleStatus';

/**
 * Blueprint metadata with its derived presentation status.
 */
export interface IBlueprintTableRow extends IBlueprint {
  status: ConfigurationStatus;
}
