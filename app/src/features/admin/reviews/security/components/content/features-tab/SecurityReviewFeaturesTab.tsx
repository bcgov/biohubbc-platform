import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { URL_PARAMS } from 'constants/query-params';
import { useSearchResultExpression } from 'features/search/result/hooks/useSearchResultExpression';
import { useSearchResultPagingSort } from 'features/search/result/hooks/useSearchResultPagingSort';
import { ISubmissionUploadReviewSecurityFeature } from 'interfaces/useAdminApi.interface';
import { useCallback, useEffect, useState } from 'react';
import { FeatureSecurityDialog } from '../../feature-security-dialog/FeatureSecurityDialog';
import { SecurityReviewFeatureTable } from '../../features/SecurityReviewFeatureTable';
import { SecurityFeaturePropertiesPanel } from '../../properties/SecurityFeaturePropertiesPanel';
import { SelectedFeatureRulesContainer } from '../../selected-rules/SelectedFeatureRulesContainer';
import { useSubmissionUploadFeatureSearch } from './useSubmissionUploadFeatureSearch';

interface SecurityReviewFeaturesTabProps {
  submissionId: number;
  submissionUploadId: string;
  submissionUploadReviewId: string;
  refreshRevision: number;
  onSecurityChanged: () => void;
}

/**
 * Renders all upload features and their shared properties and rules detail area.
 *
 * @param {SecurityReviewFeaturesTabProps} props - Security review features tab properties.
 * @returns {JSX.Element} Rendered security review features tab.
 */
export const SecurityReviewFeaturesTab = (props: SecurityReviewFeaturesTabProps) => {
  const [featureRefreshRevision, setFeatureRefreshRevision] = useState(0);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<number[]>([]);
  const [propertyFeature, setPropertyFeature] = useState<ISubmissionUploadReviewSecurityFeature | null>(null);
  const [lastPropertyFeature, setLastPropertyFeature] = useState<ISubmissionUploadReviewSecurityFeature | null>(null);
  const [securityFeature, setSecurityFeature] = useState<ISubmissionUploadReviewSecurityFeature | null>(null);
  const { expressionTree, expressionApplyRevision, handleExpressionApply } = useSearchResultExpression();
  const featureSearch = useSubmissionUploadFeatureSearch(
    props.submissionId,
    props.submissionUploadId,
    expressionTree,
    expressionApplyRevision,
    props.refreshRevision + featureRefreshRevision
  );
  const { handlePageChange, handlePageSizeChange } = useSearchResultPagingSort({
    cursor: featureSearch.cursor,
    setSearchParams: featureSearch.setSearchParams
  });

  const openFeatureProperties = useCallback((feature: ISubmissionUploadReviewSecurityFeature): void => {
    setLastPropertyFeature(feature);
    setPropertyFeature(feature);
  }, []);

  const clearFeatureContext = () => {
    setSelectedFeatureIds([]);
    setPropertyFeature(null);
  };

  useEffect(() => {
    clearFeatureContext();
  }, [expressionTree, expressionApplyRevision]);

  return (
    <Stack spacing={2}>
      <Box
        display="grid"
        gridTemplateColumns={{
          xs: '1fr',
          sm: 'minmax(0, 3fr) minmax(360px, 2fr)'
        }}
        gap={2}>
        <SecurityReviewFeatureTable
          rows={featureSearch.rows}
          totalCount={featureSearch.totalCount}
          isLoading={featureSearch.isLoading && !featureSearch.response}
          searchTerm={featureSearch.searchParams.get(URL_PARAMS.SEARCH_QUERY) || ''}
          expressionTree={expressionTree}
          cursor={featureSearch.cursor}
          selectedFeatureIds={selectedFeatureIds}
          onPageChange={(cursor) => {
            clearFeatureContext();
            handlePageChange(cursor);
          }}
          onPageSizeChange={(limit) => {
            clearFeatureContext();
            handlePageSizeChange(limit);
          }}
          onSelectionChange={(ids) => {
            setSelectedFeatureIds(ids);
            setPropertyFeature(null);
          }}
          onExpressionApply={handleExpressionApply}
          onOpenProperties={openFeatureProperties}
          onOpenSecurity={setSecurityFeature}
        />
        <Box>
          <Box display={propertyFeature ? 'block' : 'none'}>
            <SecurityFeaturePropertiesPanel
              submissionId={props.submissionId}
              submissionUploadId={props.submissionUploadId}
              feature={lastPropertyFeature}
              onClose={() => setPropertyFeature(null)}
            />
          </Box>
          <Box display={propertyFeature ? 'none' : 'block'}>
            <SelectedFeatureRulesContainer
              refreshRevision={props.refreshRevision}
              submissionId={props.submissionId}
              submissionUploadId={props.submissionUploadId}
              submissionUploadReviewId={props.submissionUploadReviewId}
              selectedFeatureIds={selectedFeatureIds}
              expression={expressionTree ?? undefined}
              onRuleChanged={() => setFeatureRefreshRevision((revision) => revision + 1)}
              onChanged={props.onSecurityChanged}
            />
          </Box>
        </Box>
      </Box>
      <FeatureSecurityDialog
        onChanged={props.onSecurityChanged}
        submissionId={props.submissionId}
        submissionUploadId={props.submissionUploadId}
        submissionUploadReviewId={props.submissionUploadReviewId}
        feature={securityFeature}
        onClose={() => setSecurityFeature(null)}
      />
    </Stack>
  );
};
