import { getLogger } from '../utils/logger';
import { refreshMaterializedViews } from './materialized-views/cronjob';

const defaultLog = getLogger('materialized-view-refresh-cronjob');

refreshMaterializedViews()
  .then((data) => {
    defaultLog.info({ message: 'Cronjob completed.', information: data });
    process.exit(0);
  })
  .catch((error) => {
    defaultLog.error({ message: 'Cronjob failed.', error });
    process.exit(1);
  });
