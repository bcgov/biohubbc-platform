import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { ISubmissionFeature } from 'interfaces/useFeaturesApi.interface';
import { PropsWithChildren, ReactNode, useState } from 'react';
import { SubmissionFeatureDetailContent } from './SubmissionFeatureDetailContent';
import { SubmissionFeatureHeader, SubmissionFeatureTab } from './header/SubmissionFeatureHeader';
import { SubmissionFeatureSkeleton } from './skeleton/SubmissionFeatureSkeleton';

interface SubmissionFeatureLayoutProps {
  isLoading: boolean;
  feature?: ISubmissionFeature;
  rootBreadcrumbLabel: string;
  rootBreadcrumbTo: string;
  submissionDetailBasePath: string;
  queryString?: string;
  buttons?: ReactNode;
  breadcrumbs?: ReactNode;
}

/** Shared loading, header, and tab layout for public, portal, and review feature pages. */
export const SubmissionFeatureLayout = ({
  isLoading,
  feature,
  children,
  ...headerProps
}: PropsWithChildren<SubmissionFeatureLayoutProps>) => {
  const [activeTab, setActiveTab] = useState<SubmissionFeatureTab>('details');

  return (
    <LoadingGuard
      isLoading={isLoading && !feature}
      isLoadingFallback={<SubmissionFeatureSkeleton />}
      isLoadingFallbackDelay={300}
      hasNoData={!feature}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography color="text.secondary">No data available</Typography>
        </Box>
      }>
      {feature && (
        <>
          <SubmissionFeatureHeader
            {...headerProps}
            feature={feature}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <ComponentSwitch<SubmissionFeatureTab>
            switch={activeTab}
            components={{
              details: <SubmissionFeatureDetailContent feature={feature}>{children}</SubmissionFeatureDetailContent>
            }}
          />
        </>
      )}
    </LoadingGuard>
  );
};
