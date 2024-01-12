import { Box, Typography } from '@mui/material';
import { Stack } from '@mui/system';

export interface ISecurityRuleCardProps {
  key?: string | number;
  title: string;
  category: string;
  description: string;
  featureMembers?: string[];
}

const SecurityRuleCard = (props: ISecurityRuleCardProps) => {
  return (
    <Box>
      <Typography variant="body2" color="textSecondary">
        {props.category}
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
        {props.description}
      </Typography>
      {props.featureMembers && props.featureMembers?.length && (
        <Stack component="ul" mt={1} pl={0} mb={0} display="flex" flexDirection="row" gap={2}>
          {props.featureMembers.map((featureMember) => (
            <Typography variant="body2" color="textSecondary" sx={{ display: 'block' }} component="li">
              {featureMember}
            </Typography>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default SecurityRuleCard;
