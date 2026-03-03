import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';

export const hasSecureResults = (rows: SearchFeatureResultWithRelevancy[]): boolean => {
  return rows.some((r) => r.is_secured);
};
