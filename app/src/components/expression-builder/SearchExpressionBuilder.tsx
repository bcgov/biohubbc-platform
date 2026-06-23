import { mdiCodeBraces, mdiSourceBranch } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { getExpressionBuilderPropertyKeyFromProperty } from 'utils/expression';
import { ExpressionBuilder } from './ExpressionBuilder';
import { ExpressionBuilderProps } from './ExpressionBuilder.interface';

interface SearchExpressionBuilderProps extends Omit<ExpressionBuilderProps, 'slots'> {
  onCancel?: () => unknown;
}

/**
 * Search-specific expression builder composition.
 *
 * Owns the search popover presentation: suggestions, labels, padding, and
 * Apply/Cancel actions. The shared `ExpressionBuilder` owns only the tree
 * editing behavior.
 *
 * @param {SearchExpressionBuilderProps} props
 * @returns {JSX.Element}
 */
export const SearchExpressionBuilder = ({ onCancel, ...props }: SearchExpressionBuilderProps) => (
  <Paper
    elevation={0}
    sx={{
      bgcolor: 'background.paper',
      borderRadius: 1,
      display: 'flex',
      flex: '1 1 auto',
      flexDirection: 'column',
      maxHeight: '60vh',
      minHeight: 0,
      transition: 'none',
      '& [data-testid="expression-input-surface"]': {
        p: 2,
        pb: 1
      }
    }}>
    <ExpressionBuilder
      {...props}
      slots={{
        header: ({
          hasSuggestions,
          suggestedProperties,
          suggestedSpecies,
          onSuggestedPropertyClick,
          onSuggestedSpeciesClick
        }) => (
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
        ),
        footer: ({ onApply }) => (
          <Stack
            direction="row"
            justifyContent="flex-end"
            gap={1}
            sx={{
              bgcolor: 'background.paper',
              borderTop: '1px solid',
              borderColor: 'divider',
              flex: '0 0 auto'
            }}>
            <Stack gap={1} flexDirection="row" p={2}>
              <Button variant="contained" onClick={onApply} size="small">
                Apply
              </Button>
              <Button variant="outlined" color="inherit" onClick={onCancel} size="small">
                Cancel
              </Button>
            </Stack>
          </Stack>
        )
      }}
    />
  </Paper>
);
