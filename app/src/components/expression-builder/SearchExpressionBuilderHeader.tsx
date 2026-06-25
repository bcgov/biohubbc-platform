import { mdiCodeBraces, mdiSourceBranch } from '@mdi/js';
import Icon from '@mdi/react';
import { Chip, Stack, Typography } from '@mui/material';
import { getExpressionBuilderPropertyKeyFromProperty } from 'utils/expression';
import { SearchExpressionBuilderSlotProps } from './SearchExpressionBuilder.interface';

/**
 * Renders search-specific expression builder suggestions and filter label.
 *
 * @param {SearchExpressionBuilderSlotProps} props - Suggestion state and selection callbacks.
 * @returns {JSX.Element}
 */
export const SearchExpressionBuilderHeader = ({
  hasSuggestions,
  suggestedProperties,
  suggestedSpecies,
  onSuggestedPropertyClick,
  onSuggestedSpeciesClick
}: SearchExpressionBuilderSlotProps) => (
  <>
    {hasSuggestions && (
      <Stack gap={1} mb={2}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">
          Suggested
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {suggestedProperties.map((suggestion) => (
            <Chip
              key={getExpressionBuilderPropertyKeyFromProperty(suggestion)}
              icon={<Icon path={mdiCodeBraces} size={0.6} />}
              label={suggestion.label}
              variant="outlined"
              onClick={() => onSuggestedPropertyClick(suggestion)}
              sx={{
                borderColor: 'divider',
                borderRadius: 1,
                color: 'text.secondary',
                cursor: 'pointer',
                fontWeight: 500,
                height: 30,
                '& .MuiChip-icon': {
                  flexShrink: 0,
                  height: 18,
                  mx: 0.25,
                  width: 18
                }
              }}
            />
          ))}
          {suggestedSpecies.map((suggestion) => (
            <Chip
              key={suggestion.value}
              icon={<Icon path={mdiSourceBranch} size={0.6} />}
              label={suggestion.label}
              variant="outlined"
              onClick={() => onSuggestedSpeciesClick(suggestion)}
              sx={{
                borderColor: 'divider',
                borderRadius: 1,
                color: 'text.secondary',
                cursor: 'pointer',
                fontWeight: 500,
                height: 30,
                '& .MuiChip-icon': {
                  flexShrink: 0,
                  height: 18,
                  mx: 0.25,
                  width: 18
                }
              }}
            />
          ))}
        </Stack>
      </Stack>
    )}

    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
      Filters
    </Typography>
  </>
);
