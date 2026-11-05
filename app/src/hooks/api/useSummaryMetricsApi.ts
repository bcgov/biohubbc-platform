import { AxiosInstance, AxiosRequestConfig } from 'axios';
import { LatestSummaryMetricsResponse } from 'interfaces/useSummaryMetricsApi.interface';

/** API methods for platform summary metrics. */
export const useSummaryMetricsApi = (axios: AxiosInstance) => {
  /** Fetch the latest active value for each active metric, with optional request cancellation. */
  const getLatestSummaryMetrics = async (
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<LatestSummaryMetricsResponse> => {
    const { data } = await axios.get<LatestSummaryMetricsResponse>('/api/summary-metrics-data/latest', options);
    return data;
  };

  return { getLatestSummaryMetrics };
};
