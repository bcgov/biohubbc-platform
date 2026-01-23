import { mdiCubeOutline, mdiSquareSmall } from '@mdi/js';
import Icon from '@mdi/react';
import { Box } from '@mui/material';
import { SearchFeatureResult, SearchResponse } from 'interfaces/useSearchApi.interface';
import { SearchOptionItem } from '../components/SearchOptionItem';
import { SearchSectionHeader } from './header/SearchSectionHeader';
import { SearchTaxonCard } from './taxonomy/SearchTaxonCard';

export interface SearchResultsSectionProps {
  results: SearchResponse;
  onSubmissionSelect: (submissionId: number) => void;
  onTaxonomySelect: (taxonId: number) => void;
  onFeatureSelect: (featureId: number) => void;
}

export const SearchResultsSection = ({
  results,
  onSubmissionSelect,
  onTaxonomySelect,
  onFeatureSelect
}: SearchResultsSectionProps) => {
  const { features, submissions, taxonomy } = results;

  const renderFeaturesList = () => (
    <Box>
      <SearchSectionHeader label="Features" />
      {features.data.map((item: SearchFeatureResult) => (
        <SearchOptionItem
          key={`feature-${item.submission_feature_id}`}
          name={item.label}
          startIcon={<Icon path={mdiSquareSmall} size={1} style={{ display: 'block' }} />}
          onSelect={() => onFeatureSelect(item.submission_feature_id)}
        />
      ))}
    </Box>
  );

  const renderSubmissionsList = () => (
    <Box>
      <SearchSectionHeader label="Submissions" />
      {submissions.data.map((item) => (
        <SearchOptionItem
          key={`submission-${item.submission_id}`}
          name={item.name}
          startIcon={<Icon path={mdiCubeOutline} size={1} style={{ display: 'block' }} />}
          onSelect={() => onSubmissionSelect(item.submission_id)}
        />
      ))}
    </Box>
  );

  const renderTaxonomyList = () => (
    <Box>
      <SearchSectionHeader label="Species" />
      <SearchTaxonCard
        key={taxonomy.data[0].taxon_id}
        taxon={taxonomy.data[0]}
        onSelect={(id) => onTaxonomySelect(id)}
      />
    </Box>
  );

  return (
    <>
      {features.data.length > 0 && renderFeaturesList()}
      {submissions.data.length > 0 && renderSubmissionsList()}
      {taxonomy.data.length > 0 && renderTaxonomyList()}
    </>
  );
};
