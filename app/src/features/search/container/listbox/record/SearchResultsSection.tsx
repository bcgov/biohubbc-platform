import { mdiCubeOutline, mdiSourceBranch, mdiSquareMediumOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, ListItemButton, ListItemIcon, ListItemText, Stack } from '@mui/material';
import {
  SearchFeatureResult,
  SearchResponse,
  SearchSubmissionResult,
  SearchTaxonResult
} from 'interfaces/useSearchApi.interface';
import { SearchSectionHeader } from './header/SearchSectionHeader';

export interface SearchResultsSectionProps {
  results: SearchResponse;
  onSelect: (value: string | number) => void;
}

export const SearchResultsSection = ({ results, onSelect }: SearchResultsSectionProps) => {
  const { features, submissions, taxonomy } = results;

  return (
    <>
      {/* Species / Taxonomy */}
      {taxonomy.data.length > 0 && (
        <Stack sx={{ mt: 1 }}>
          <SearchSectionHeader label="Species" />

          {taxonomy.data.map((taxon: SearchTaxonResult) => (
            <ListItemButton
              key={`taxon-${taxon.taxon_id}`}
              role="option"
              onClick={() => onSelect(taxon.itis_scientific_name)}
              data-search-item
              sx={{ borderRadius: 1 }}>
              <ListItemIcon>
                <Icon path={mdiSourceBranch} size={1} style={{ display: 'block' }} />
              </ListItemIcon>

              <ListItemText primary={taxon.itis_scientific_name} />
            </ListItemButton>
          ))}
        </Stack>
      )}

      {/* Features */}
      {features.data.length > 0 && (
        <Stack sx={{ mt: 1 }}>
          <SearchSectionHeader label="Features" />

          {features.data.map((feature: SearchFeatureResult) => (
            <ListItemButton
              key={`feature-${feature.submission_feature_id}`}
              role="option"
              onClick={() => onSelect(feature.label)}
              data-search-item
              sx={{ borderRadius: 1 }}>
              <ListItemIcon>
                <Icon path={mdiSquareMediumOutline} size={1} style={{ display: 'block' }} />
              </ListItemIcon>

              <ListItemText primary={<Box flex="1 1 auto">{feature.label}</Box>} />
            </ListItemButton>
          ))}
        </Stack>
      )}

      {/* Submissions */}
      {submissions.data.length > 0 && (
        <Stack sx={{ mt: 1 }}>
          <SearchSectionHeader label="Submissions" />

          {submissions.data.map((submission: SearchSubmissionResult) => (
            <ListItemButton
              key={`submission-${submission.submission_id}`}
              role="option"
              onClick={() => onSelect(submission.name)}
              data-search-item
              sx={{ borderRadius: 1 }}>
              <ListItemIcon>
                <Icon path={mdiCubeOutline} size={1} style={{ display: 'block' }} />
              </ListItemIcon>

              <ListItemText primary={<Box flex="1 1 auto">{submission.name}</Box>} />
            </ListItemButton>
          ))}
        </Stack>
      )}
    </>
  );
};
