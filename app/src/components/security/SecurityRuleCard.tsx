import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export interface ISecurityRuleCardProps {
  key?: string | number;
  title: string;
  category: string;
  description: string;
  featureMembers?: string[];
}

const SecurityRuleCard = (props: ISecurityRuleCardProps) => {
  return (
    <Stack gap={0.75} mt={-0.25}>
      <Typography variant="body2" component="div" color="textSecondary" textTransform="uppercase">
        {props.category}
      </Typography>
      <Stack>
        <Typography
          variant="body1"
          fontWeight={700}
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: '2',
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
          {props.title}
        </Typography>
        <Typography
          variant="body1"
          color="textSecondary"
          sx={{
            display: '-webkit-box',
            maxWidth: '92ch',
            WebkitLineClamp: '2',
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
          {props.description}
        </Typography>
      </Stack>
      {props.featureMembers && props.featureMembers?.length && (
        <Stack component="ul" flexDirection="row" gap={2} mt={0.75} mb={0} p={0}>
          {props.featureMembers.map((featureMember) => (
            <Typography key={featureMember} component="li" variant="body2" color="textSecondary" fontWeight={700} sx={{ display: 'block' }}>
              {featureMember}
            </Typography>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export default SecurityRuleCard;
