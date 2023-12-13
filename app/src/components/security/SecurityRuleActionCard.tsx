import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, Paper } from '@mui/material';
import SecurityRuleCard from './SecurityRuleCard';

interface ISecurityRuleActionCardProps {
  index: number;
  remove: (id: number) => void;
  security_rule_id: number;
  name: string;
  description: string;
}

const SecurityRuleActionCard = (props: ISecurityRuleActionCardProps) => {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        p: 1,
        mb: 1
      }}>
      <SecurityRuleCard key={props.security_rule_id} title={props.name} subtitle={props.description} />
      <IconButton onClick={() => props.remove(props.index)}>
        <Icon path={mdiClose} size={1} />
      </IconButton>
    </Paper>
  );
};
export default SecurityRuleActionCard;
