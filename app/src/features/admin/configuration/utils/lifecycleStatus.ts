import dayjs from 'dayjs';

export type ConfigurationStatus = 'Active' | 'Scheduled' | 'Draft' | 'Retired';

interface IConfigurationLifecycleDates {
  record_effective_date?: string | null;
  record_end_date?: string | null;
}

/**
 * Derive a Configuration record's displayed lifecycle status from its dates.
 *
 * @param record Effective and end dates returned by the API.
 * @returns Presentation status; server mutation checks remain authoritative.
 */
export const getConfigurationStatus = (record: IConfigurationLifecycleDates): ConfigurationStatus => {
  const today = dayjs().format('YYYY-MM-DD');
  if (record.record_end_date && record.record_end_date <= today) {
    return 'Retired';
  }
  if (!record.record_effective_date) {
    return 'Draft';
  }
  if (record.record_effective_date > today) {
    return 'Scheduled';
  }
  return 'Active';
};
