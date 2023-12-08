import { Box, Typography } from '@mui/material';

interface ISecurityRuleCardProps {
  title: string;
  subtitle: string;
}
const SecurityRuleCard = (props: ISecurityRuleCardProps) => {
  return (
    <Box>
      <Box>
        <Typography variant="subtitle1" fontWeight="bold">
          {props.title}
        </Typography>
      </Box>
      <Box my={0.25}>
        <Typography variant="subtitle2" color="textSecondary">
          {props.subtitle}
        </Typography>
      </Box>
    </Box>
  );
};

export default SecurityRuleCard;
