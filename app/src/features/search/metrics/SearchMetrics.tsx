import { Container, Grid, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import dayjs from 'dayjs';
import { useApi } from 'hooks/useApi';
import { useId } from 'react';
import { summaryMetricQueryKeys } from 'utils/query-keys/summary-metric-query-keys';

/** Choose which metrics appear on the landing page, their labels, and their display order. */
const DISPLAY_METRICS = [
  { key: 'earliest_date', label: 'Earliest data' },
  { key: 'survey_count', label: 'Surveys' },
  { key: 'record_count', label: 'Records' }
] as const;

/** Display scalar metric values without treating missing dates or counts as zero. */
const formatMetricValue = (value: unknown): string | null => {
  if (value === null) {
    return '—';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString('en-CA');
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && dayjs(value).isValid()) {
      return dayjs(value).format(DATE_FORMAT.ShortMediumDateFormat);
    }
    return value;
  }
  // Structured JSON metrics need a presentation of their own; never render [object Object].
  return null;
};

/** Selected latest summary metrics for the search landing page. */
export const SearchMetrics = () => {
  const api = useApi();
  const headingId = useId();
  const metricsQuery = useQuery({
    queryKey: summaryMetricQueryKeys.latest(),
    queryFn: ({ signal }) => api.summaryMetrics.getLatestSummaryMetrics({ signal })
  });

  const metrics = DISPLAY_METRICS.flatMap(({ key, label }) => {
    const metric = metricsQuery.data?.summary_metrics_data.find((item) => item.key === key);
    if (!metric) {
      return [];
    }
    const formattedValue = formatMetricValue(metric.value);
    return formattedValue === null ? [] : [{ ...metric, label, formattedValue }];
  });

  return (
    <LoadingGuard hasNoData={Boolean(metricsQuery.error) || metrics.length === 0}>
      <Stack component="section" aria-labelledby={headingId} gap={2} my={5}>
        <Container maxWidth="md">
          <Typography id={headingId} variant="h3" align="center" sx={{ mb: 2 }}></Typography>
          <Grid container spacing={2} justifyContent="center">
            {metrics.map((metric) => (
              <Grid key={metric.summary_metric_id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper component="dl" variant="outlined" sx={{ p: 3, height: 1, m: 0, textAlign: 'center' }}>
                  <Typography component="dd" variant="h3" sx={{ m: 0, mt: 1 }}>
                    {metric.formattedValue}
                  </Typography>
                  <Typography component="dt" variant="body2" color="text.secondary" title={metric.description}>
                    {metric.label}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Stack>
    </LoadingGuard>
  );
};
