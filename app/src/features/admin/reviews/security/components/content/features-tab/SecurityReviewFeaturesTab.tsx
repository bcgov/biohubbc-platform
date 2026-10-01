import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { useQueryClient } from '@tanstack/react-query';
import { URL_PARAMS } from 'constants/query-params';
import { useSearchResultExpression } from 'features/search/result/hooks/useSearchResultExpression';
import { useSearchResultPagingSort } from 'features/search/result/hooks/useSearchResultPagingSort';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
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
}

/**
 * Renders all upload features and their shared properties and rules detail area.
 *
 * @param {SecurityReviewFeaturesTabProps} props - Security review features tab properties.
 * @returns {JSX.Element} Rendered security review features tab.
 */
export const SecurityReviewFeaturesTab = (props: SecurityReviewFeaturesTabProps) => {
  const queryClient = useQueryClient();
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<number[]>([]);
  const [propertyFeature, setPropertyFeature] = useState<ISubmissionUploadReviewSecurityFeature | null>(null);
  const [lastPropertyFeature, setLastPropertyFeature] = useState<ISubmissionUploadReviewSecurityFeature | null>(null);
  const [securityFeature, setSecurityFeature] = useState<ISubmissionUploadReviewSecurityFeature | null>(null);
  const { expressionTree, handleExpressionApply } = useSearchResultExpression();
  const featureSearch = useSubmissionUploadFeatureSearch(props.submissionId, props.submissionUploadId, expressionTree);
  const { handlePageChange, handlePageSizeChange } = useSearchResultPagingSort({
    cursor: featureSearch.cursor,
    setSearchParams: featureSearch.setSearchParams
  });

  const openFeatureProperties = useCallback((feature: ISubmissionUploadReviewSecurityFeature): void => {
    setLastPropertyFeature(feature);
    setPropertyFeature(feature);
  }, []);

  /**
   * Clears the feature selection and closes the properties panel.
   *
   * @returns {void}
   */
  const clearFeatureContext = () => {
    setSelectedFeatureIds([]);
    setPropertyFeature(null);
  };

  useEffect(() => {
    clearFeatureContext();
  }, [expressionTree]);

  /**
   * Applies an expression. Re-applying the one already applied leaves the URL, and so every query key,
   * unchanged; it is still a request to search again, so the search is invalidated instead.
   *
   * @param {ExpressionTreeExpression | null} expression The expression to apply, or null to clear it.
   * @returns {void}
   */
  const applyExpression = (expression: ExpressionTreeExpression | null): void => {
    if (!handleExpressionApply(expression)) {
      clearFeatureContext();
      void queryClient.invalidateQueries({ queryKey: submissionUploadQueryKeys.featureSearch(props) });
    }
  };

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
          onExpressionApply={applyExpression}
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
              submissionId={props.submissionId}
              submissionUploadId={props.submissionUploadId}
              submissionUploadReviewId={props.submissionUploadReviewId}
              selectedFeatureIds={selectedFeatureIds}
              expression={expressionTree ?? undefined}
            />
          </Box>
        </Box>
      </Box>
      <FeatureSecurityDialog
        submissionId={props.submissionId}
        submissionUploadId={props.submissionUploadId}
        submissionUploadReviewId={props.submissionUploadReviewId}
        feature={securityFeature}
        onClose={() => setSecurityFeature(null)}
      />
    </Stack>
  );
};
