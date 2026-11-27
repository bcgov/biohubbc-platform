import { QUERY_KEY_ROOT } from 'constants/query-keys';

/** Latest platform metrics, shared between anonymous and authenticated landing-page views. */
const latest = () => [QUERY_KEY_ROOT.SUMMARY_METRIC, 'latest'] as const;

export const summaryMetricQueryKeys = { latest };
