import { Box, Typography } from '@mui/material';

interface ISecurityRuleCardProps {
  title: string;
  category: string;
  subtitle: string;
}
const SecurityRuleCard = (props: ISecurityRuleCardProps) => {
  return (
    <Box>
      <Typography
        variant="body2"
        color="textSecondary"
      >
        {props.category}Persection and Harm
      </Typography>
      <Typography
        variant="body1"
        fontWeight={700}
        gutterBottom
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
          maxWidth: '92ch',
          WebkitLineClamp: '2',
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
        {props.subtitle}
      </Typography>
    </Box>
  );
};

export default SecurityRuleCard;
