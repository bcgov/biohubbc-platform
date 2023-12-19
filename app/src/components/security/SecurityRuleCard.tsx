import { Stack, Typography } from '@mui/material';

interface ISecurityRuleCardProps {
  title: string;
  subtitle: string;
}
const SecurityRuleCard = (props: ISecurityRuleCardProps) => {
  return (
    <Stack gap={0.5}>
      <Typography
        variant="body1"
        fontWeight="bold"
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
        variant="body2"
        color="textSecondary"
        sx={{
          display: '-webkit-box',
          WebkitLineClamp: '2',
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
        {props.subtitle}
      </Typography>
    </Stack>
  );
};

export default SecurityRuleCard;
