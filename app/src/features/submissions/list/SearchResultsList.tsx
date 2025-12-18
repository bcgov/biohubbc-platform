import { mdiCommentOutline, mdiTextBoxSearchOutline, mdiTrayArrowDown } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import { grey } from '@mui/material/colors';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/system/Stack';
import { SearchFeatureResult } from 'interfaces/useSearchApi.interface';

export interface ISearchResultsListProps {
  results: SearchFeatureResult[];
  onDownload: (result: SearchFeatureResult) => void;
  onAccessRequest: (result: SearchFeatureResult) => void;
}

/**
 * Displays search results as feature-level cards with download/request access actions.
 *
 * @param {ISearchResultsListProps} props
 * @returns {JSX.Element}
 */
export const SearchResultsList = (props: ISearchResultsListProps) => {
  const { results, onDownload, onAccessRequest } = props;

  if (results.length === 0) {
    return (
      <Stack alignItems="center" justifyContent="center" p={3} component={Paper} elevation={0} minHeight={168}>
        <Box
          sx={{
            '& svg': {
              color: 'text.secondary'
            }
          }}>
          <Icon path={mdiTextBoxSearchOutline} size={2} />
        </Box>
        <Typography
          data-testid="no-search-results"
          component="h2"
          variant="h4"
          fontWeight={700}
          sx={{
            mb: 1
          }}>
          No features found
        </Typography>
        <Typography color="textSecondary">Try different keywords or check your spelling.</Typography>
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      {results.map((result) => (
        <Card elevation={0} key={result.submission_feature_id}>
          <CardHeader
            title={
              <Typography
                variant="h4"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: '2',
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                {result.feature_name || `Feature #${result.submission_feature_id}`}
              </Typography>
            }
            action={
              <Chip
                label={result.feature_type_name}
                size="small"
                sx={{
                  my: '-2px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}
              />
            }
            sx={{
              pb: 1,
              '& .MuiCardHeader-action': {
                margin: 0
              }
            }}
          />
          <CardContent
            sx={{
              pt: 0
            }}>
            <Typography variant="body2" color="textSecondary" mb={1}>
              From: {result.submission_name}
            </Typography>
            {result.feature_description && (
              <Typography
                variant="body1"
                color="textSecondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: '2',
                  WebkitBoxOrient: 'vertical',
                  maxWidth: 800,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                {result.feature_description}
              </Typography>
            )}
          </CardContent>
          <CardActions
            sx={{
              px: 2,
              py: 1.5,
              borderTop: '1px solid' + grey[200]
            }}>
            <Stack
              width="100%"
              flexDirection={{ xs: 'column', sm: 'row' }}
              flexWrap="wrap"
              gap={1}
              justifyContent="space-between">
              <Stack flex="1 1 auto" my={1} alignItems="center" flexDirection="row">
                {result.is_secured && (
                  <Chip
                    label="Secured"
                    size="small"
                    color="warning"
                    sx={{
                      fontSize: '12px',
                      borderRadius: '4px'
                    }}
                  />
                )}
              </Stack>
              <Stack flexDirection="row" alignItems="center" gap={1} flexWrap="nowrap">
                {result.is_secured ? (
                  <Button
                    variant="contained"
                    disableElevation
                    startIcon={<Icon path={mdiCommentOutline} size={0.75} />}
                    sx={{
                      fontWeight: 700
                    }}
                    onClick={() => onAccessRequest(result)}>
                    Request Access
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    startIcon={<Icon path={mdiTrayArrowDown} size={0.75} />}
                    onClick={() => onDownload(result)}>
                    Download
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardActions>
        </Card>
      ))}
    </Stack>
  );
};

export default SearchResultsList;
