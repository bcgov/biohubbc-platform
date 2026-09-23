import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ISubmissionUploadReviewFeatureRule } from 'interfaces/useAdminApi.interface';

interface FeatureSecurityRuleCardProps {
  rule: ISubmissionUploadReviewFeatureRule;
  onRemove: () => void;
}

/**
 * Displays a rule's name, description, and direct-assignment removal action.
 * @param {FeatureSecurityRuleCardProps} props Rule details and removal controls.
 * @returns {React.JSX.Element} Security rule card.
 */
export const FeatureSecurityRuleCard = (props: FeatureSecurityRuleCardProps) => {
  const inherited = props.rule.provenance === 'inherited';
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, backgroundColor: 'background.default' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 0.5 }}>
          <Typography fontWeight={700}>{props.rule.name}</Typography>
          {inherited ? (
            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
              Inherited
            </Typography>
          ) : (
            <Button size="small" color="error" variant="contained" onClick={props.onRemove} sx={{ flexShrink: 0 }}>
              Remove
            </Button>
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {props.rule.description || 'No description provided.'}
        </Typography>
      </CardContent>
    </Card>
  );
};
