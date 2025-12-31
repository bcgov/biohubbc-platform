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
  onViewMore: (sectionKey: string) => void;
}

export const SearchResultsSection = ({
  results,
  onSubmissionSelect,
  onTaxonomySelect,
  onFeatureSelect,
  onViewMore
}: SearchResultsSectionProps) => {
  const { features, submissions, taxonomy } = results;

  const renderFeaturesList = () => (
    <Box>
      <SearchSectionHeader label="Features" onTitleClick={() => onViewMore('features')} />
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
      <SearchSectionHeader label="Submissions" onTitleClick={() => onViewMore('submissions')} />
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

  const renderTaxonomyList = () => {
    if (taxonomy.data.length === 0) {
      return null;
    }

    /**
     * Highlight the first taxon (best match) with a cardcomponent
     */
    const firstTaxon = taxonomy.data[0];

    return (
      <Box>
        <SearchSectionHeader label="Species" onTitleClick={() => onViewMore('taxonomy')} />
        <SearchTaxonCard key={firstTaxon.taxon_id} taxon={firstTaxon} onSelect={(id) => onTaxonomySelect(id)} />
      </Box>
    );
  };

  return (
    <>
      {features.data.length > 0 && renderFeaturesList()}
      {submissions.data.length > 0 && renderSubmissionsList()}
      {taxonomy.data.length > 0 && renderTaxonomyList()}
    </>
  );
};
