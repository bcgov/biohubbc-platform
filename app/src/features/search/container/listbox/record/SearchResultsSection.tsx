import { mdiCubeOutline, mdiSourceBranch, mdiSquareSmall } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, ListItemButton, ListItemIcon, ListItemText, Stack } from '@mui/material';
import { grey } from '@mui/material/colors';
import { SearchFeatureResult, SearchResponse } from 'interfaces/useSearchApi.interface';
import { pluralize } from 'utils/Utils';
import { SearchSectionHeader } from './header/SearchSectionHeader';

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

  const renderFeatures = () => (
    <Stack>
      <SearchSectionHeader label="Features" />
      {features.data.map((item: SearchFeatureResult) => (
        <ListItemButton
          role="option"
          key={`feature-${item.submission_feature_id}`}
          onClick={() => onFeatureSelect(item.submission_feature_id)}
          data-search-item
          sx={{ borderRadius: 1 }}>
          <ListItemIcon>
            <Icon path={mdiSquareSmall} size={1} style={{ display: 'block' }} />
          </ListItemIcon>
          <ListItemText primary={<Box flex="1 1 auto">{item.label}</Box>} sx={{ m: 0 }} />
        </ListItemButton>
      ))}
    </Stack>
  );

  const renderSubmissions = () => (
    <Stack sx={{ mt: 1 }}>
      <SearchSectionHeader label="Submissions" />
      {submissions.data.map((item) => (
        <ListItemButton
          role="option"
          key={`submission-${item.submission_id}`}
          onClick={() => onSubmissionSelect(item.submission_id)}
          data-search-item
          sx={{ borderRadius: 1 }}>
          <ListItemIcon>
            <Icon path={mdiCubeOutline} size={1} style={{ display: 'block' }} />
          </ListItemIcon>
          <ListItemText primary={<Box flex="1 1 auto">{item.name}</Box>} sx={{ m: 0 }} />
        </ListItemButton>
      ))}
    </Stack>
  );

  const renderTaxonomy = () => (
    <Stack sx={{ mt: 1 }}>
      <SearchSectionHeader label="Species" />
      {taxonomy.data.map((t) => {
        const countLabel = pluralize(1, 'result');
        return (
          <ListItemButton
            role="option"
            key={`taxon-${t.taxon_id}`}
            onClick={() => onTaxonomySelect(t.taxon_id)}
            data-search-item
            sx={{ borderRadius: 1, bgcolor: grey[50] }}>
            <ListItemIcon>
              <Icon path={mdiSourceBranch} size={1} style={{ display: 'block' }} />
            </ListItemIcon>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center">
                  <Box flex="1 1 auto">{t.itis_scientific_name}</Box>
                  <Box flex="0 0 auto" color="text.secondary">
                    {countLabel}
                  </Box>
                </Box>
              }
              sx={{ m: 0 }}
            />
          </ListItemButton>
        );
      })}
    </Stack>
  );

  return (
    <>
      {features.data.length > 0 && renderFeatures()}
      {submissions.data.length > 0 && renderSubmissions()}
      {taxonomy.data.length > 0 && renderTaxonomy()}
    </>
  );
};
