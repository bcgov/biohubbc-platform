import { Box, Typography } from '@mui/material';
import { ReactNode } from 'react';

export interface ISecurityRuleCardProps {
  key?: string | number;
  title: string;
  category: string;
  description: string;
  featureMembers?: string[];
  actionContent?: ReactNode;
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
      {props.actionContent}
      {props.featureMembers && props.featureMembers?.length && (
        <Box component="ul" pl={4} mb={0} mt={1}>
          {props.featureMembers.map((featureMember) => (
            <Typography variant="body2" color="textSecondary" sx={{}} component="li">
              {featureMember}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default SecurityRuleCard;
