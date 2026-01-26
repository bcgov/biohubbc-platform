import { mdiCubeOutline, mdiSourceBranch, mdiSquareSmall } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, ListItemButton, ListItemIcon, ListItemText, Stack } from '@mui/material';
import { grey } from '@mui/material/colors';
import {
  SearchFeatureResult,
  SearchResponse,
  SearchSubmissionResult,
  SearchTaxonResult
} from 'interfaces/useSearchApi.interface';
import { pluralize } from 'utils/Utils';
import { SearchSectionHeader } from './header/SearchSectionHeader';

export interface SearchResultsSectionProps {
  results: SearchResponse;
  onSelect: (value: string | number) => void;
}

export const SearchResultsSection = ({ results, onSelect }: SearchResultsSectionProps) => {
  const { features, submissions, taxonomy } = results;

  return (
    <>
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
                <Icon path={mdiSquareSmall} size={1} style={{ display: 'block' }} />
              </ListItemIcon>

              <ListItemText primary={<Box flex="1 1 auto">{feature.label}</Box>} sx={{ m: 0 }} />
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

              <ListItemText primary={<Box flex="1 1 auto">{submission.name}</Box>} sx={{ m: 0 }} />
            </ListItemButton>
          ))}
        </Stack>
      )}

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
              sx={{ borderRadius: 1, bgcolor: grey[50] }}>
              <ListItemIcon>
                <Icon path={mdiSourceBranch} size={1} style={{ display: 'block' }} />
              </ListItemIcon>

              <ListItemText
                primary={
                  <Box display="flex" alignItems="center">
                    <Box flex="1 1 auto">{taxon.itis_scientific_name}</Box>
                    <Box flex="0 0 auto" color="text.secondary">
                      {pluralize(1, 'result')}
                    </Box>
                  </Box>
                }
                sx={{ m: 0 }}
              />
            </ListItemButton>
          ))}
        </Stack>
      )}
    </>
  );
};
